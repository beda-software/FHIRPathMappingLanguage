from typing import Any, Callable, Optional, TypedDict, Union

from typing_extensions import NotRequired

Resource = dict[str, Any]
Node = Any
DictNode = dict[str, Any]
StrNode = str
Context = dict[str, Any]

Path = list[Union[str, int]]


class Model(TypedDict):
    choiceTypePaths: dict[str, list[str]]
    pathsDefinedElsewhere: dict[str, str]
    type2Parent: dict[str, str]
    path2Type: dict[str, str]


class UserFnDefinition(TypedDict):
    fn: Callable
    arity: dict[int, list[str]]
    nullable: NotRequired[bool]


UserInvocationTable = dict[str, UserFnDefinition]


class FPOptions(TypedDict):
    """
    Optional parameters for controlling FHIRPath evaluation.

    Attributes:
        model (Optional[Model]):
            An optional "model" data object specific to a domain, e.g. R4.
            See https://github.com/beda-software/fhirpath-py?tab=readme-ov-file#using-data-models
        userInvocationTable (Optional[UserInvocationTable]):
            A table of user-defined functions that
            can be used in FHIRPath expressions during template processing.
            See https://github.com/beda-software/fhirpath-py?tab=readme-ov-file#user-defined-functions

    See Also:
    FHIRPath py Documentation:
    https://github.com/beda-software/fhirpath-py?tab=readme-ov-file#fhirpathpy
    """

    model: NotRequired[Model]
    userInvocationTable: NotRequired[UserInvocationTable]


class MatcherResult(TypedDict):
    node: Optional[Node]


Matcher = Callable[
    [
        Path,
        Resource,
        DictNode,
        Context,
        Optional[FPOptions],
    ],
    Optional[MatcherResult],
]

Transformer = Callable[[Path, Node, Context], tuple[Node, Context]]
