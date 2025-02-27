from typing import Any, Optional


from .types import (
    Context,
    FPOptions,
    Model,
    Resource,
)


def resolve_template(
    resource: Resource,
    template: Any,
    context: Optional[Context] = None,
    model: Optional[Model] = None,
    fp_options: Optional[FPOptions] = None,
    strict: bool = False,
) -> Any:
    assert fp_options is None, "fp_options are not supported"
    assert strict is False, "strict is not supported yet"

    return {}