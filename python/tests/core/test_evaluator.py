from functools import lru_cache
from typing import Any

from fhirpathpy import compile as fhirpath_compile  # type: ignore
from fhirpathpy.models import models  # type: ignore

from fpml.core.core_types import Context, Resource
from fpml.core.extract import resolve_template


def test_uses_the_provided_evaluate() -> None:
    def evaluate(resource: Resource, expression: str, context: Context) -> list[Any]:
        return [f"{expression} of {resource['id']}"]

    result = resolve_template({"id": "foo"}, {"value": "{{ name }}"}, evaluate=evaluate)
    assert result == {"value": "name of foo"}


def test_passes_the_resource_expression_and_context_to_evaluate() -> None:
    calls = []

    def evaluate(resource: Resource, expression: str, context: Context) -> list[Any]:
        calls.append((resource, expression, sorted(context)))
        return [1]

    resolve_template({"id": "foo"}, {"value": "{{ name }}"}, {"extra": "bar"}, evaluate=evaluate)
    assert calls == [({"id": "foo"}, "name", ["context", "extra"])]


def test_evaluate_lets_the_caller_bring_its_own_cache() -> None:
    compiled_expressions = []

    @lru_cache(maxsize=64)
    def cached_compile(expression: str, model_name: str) -> Any:
        compiled_expressions.append(expression)
        return fhirpath_compile(expression, models.get(model_name))

    def evaluate(resource: Resource, expression: str, context: Context) -> list[Any]:
        return cached_compile(expression, "r4")(resource, context)

    resource: Resource = {"resourceType": "Patient", "id": "foo"}
    template = {"first": "{{ id }}", "second": "{{ id }}"}
    result = resolve_template(resource, template, evaluate=evaluate)
    assert result == {"first": "foo", "second": "foo"}

    assert compiled_expressions == ["id"]
