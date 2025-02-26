from typing import Any
from .types import Context, Model, Resource


class FPMLValidationError(Exception):
    def __init__(
        self,
        message: str,
        path: str,
    ) -> None:
        self.path = path
        self.message = message

        super().__init__(f"{self.message}. Path: {self.path}")


def resolve_template(
    resource: Resource, template: Any, context: Context = None, model: Model | None = None
):
    pass
