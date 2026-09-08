from typing import Any, Optional, TypedDict

from fhirpathpy import evaluate as fhirpath_evaluate  # type: ignore
from typing_extensions import NotRequired

from .core_types import Context, Evaluate, Model, Resource, UserInvocationTable


class FPOptions(TypedDict):
    """Options passed to fhirpathpy, see
    https://github.com/beda-software/fhirpath-py?tab=readme-ov-file#user-defined-functions
    """

    userInvocationTable: NotRequired[UserInvocationTable]


def make_evaluator(model: Optional[Model] = None, options: Optional[FPOptions] = None) -> Evaluate:
    """Builds the default evaluator, which compiles every expression on every evaluation."""

    def evaluate(resource: Resource, expression: str, context: Context) -> list[Any]:
        return fhirpath_evaluate(resource, expression, context, model, options)

    return evaluate
