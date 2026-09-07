import sys
from collections.abc import Iterator
from itertools import repeat
from threading import Thread
from typing import Any

import pytest

from fpml.core import cache as cache_module
from fpml.core.cache import ExpressionCache
from fpml.core.core_types import Resource
from fpml.core.extract import resolve_template


def test_reuses_compiled_expression() -> None:
    cache = ExpressionCache(max_size=16)
    compiled = cache.compile("list.key", None)
    assert cache.compile("list.key", None) is compiled


def test_evicts_least_recently_used_expression() -> None:
    max_size = 2
    cache = ExpressionCache(max_size=max_size)
    first = cache.compile("first", None)
    middle = cache.compile("middle", None)
    cache.compile("first", None)
    cache.compile("last", None)
    assert cache.size == max_size

    assert cache.compile("first", None) is first
    assert cache.compile("middle", None) is not middle


def test_does_not_cache_with_zero_max_size() -> None:
    cache = ExpressionCache(max_size=0)
    compiled = cache.compile("list.key", None)
    assert cache.compile("list.key", None) is not compiled


def test_clear_drops_compiled_expressions() -> None:
    cache = ExpressionCache(max_size=16)
    compiled = cache.compile("list.key", None)

    cache.clear()
    assert cache.compile("list.key", None) is not compiled


def test_stays_consistent_when_shared_between_threads(monkeypatch: pytest.MonkeyPatch) -> None:
    # Stub the compilation, so that the cache bookkeeping is what threads contend over
    monkeypatch.setattr(cache_module, "compile_expression", lambda expression, _: expression)
    max_size = 2
    cache = ExpressionCache(max_size=max_size)
    errors: list[Exception] = []

    def hammer(expressions: Iterator[str]) -> None:
        for expression in expressions:
            try:
                cache.compile(expression, None)
            except Exception as exc:
                errors.append(exc)
                return

    threads = [
        # Readers keep hitting one entry while churners evict it from under them
        *[Thread(target=hammer, args=(repeat("hot", 20000),)) for _ in range(4)],
        *[
            Thread(target=hammer, args=((f"churn{index}-{n}" for n in range(20000)),))
            for index in range(4)
        ],
    ]
    switch_interval = sys.getswitchinterval()
    # Preempt threads aggressively to widen the window between a lookup and its eviction
    sys.setswitchinterval(1e-6)
    try:
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
    finally:
        sys.setswitchinterval(switch_interval)

    assert errors == []
    assert cache.size == max_size


def test_resolve_template_compiles_repeated_expression_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    compiled_expressions = []
    original_compile = cache_module.fhirpath_compile

    def counting_compile(expression: str, model: Any = None, options: Any = None) -> Any:
        compiled_expressions.append(expression)
        return original_compile(expression, model, options)

    monkeypatch.setattr(cache_module, "fhirpath_compile", counting_compile)
    resource: Resource = {"list": [{"key": 1}, {"key": 2}]}
    template = {"first": "{{ list.key }}", "second": "{{ list.key }}"}
    result = resolve_template(
        resource, template, fp_options={"cache": ExpressionCache(max_size=16)}
    )
    assert result == {"first": 1, "second": 1}

    assert compiled_expressions == ["list.key"]
