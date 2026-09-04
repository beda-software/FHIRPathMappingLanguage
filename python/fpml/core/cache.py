from collections import OrderedDict
from typing import Any, Callable, Optional, cast

from fhirpathpy import compile as fhirpath_compile  # type: ignore

from .core_types import FPOptions

CompiledExpression = Callable[..., list[Any]]


def compile_expression(expression: str, fp_options: Optional[FPOptions]) -> CompiledExpression:
    options = cast(dict, fp_options or {}).copy()
    model = options.pop("model", None)
    options.pop("cache", None)

    return fhirpath_compile(expression, model, options)


class ExpressionCache:
    """LRU cache of compiled FHIRPath expressions.

    Entries are keyed by the expression only, while compilation binds the model
    and the user-defined functions, so use a separate cache per fp_options.
    Zero max size disables caching.
    """

    def __init__(self, max_size: int) -> None:
        self.max_size = max_size
        self._compiled: OrderedDict[str, CompiledExpression] = OrderedDict()

    def compile(self, expression: str, fp_options: Optional[FPOptions]) -> CompiledExpression:
        cached = self._compiled.get(expression)
        if cached is not None:
            self._compiled.move_to_end(expression)

            return cached

        compiled = compile_expression(expression, fp_options)
        if self.max_size > 0:
            self._compiled[expression] = compiled
            if len(self._compiled) > self.max_size:
                self._compiled.popitem(last=False)

        return compiled

    def clear(self) -> None:
        self._compiled.clear()

    @property
    def size(self) -> int:
        return len(self._compiled)
