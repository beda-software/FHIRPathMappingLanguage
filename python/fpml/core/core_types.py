from typing import TYPE_CHECKING, Any, Callable, Optional, TypedDict, Union

from typing_extensions import NotRequired

if TYPE_CHECKING:
    from .cache import ExpressionCache

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
        cache (Optional[ExpressionCache]):
            A cache of compiled expressions, e.g. ExpressionCache(max_size=1024).
            Expressions are compiled on every evaluation when it's not passed.

    See Also:
    FHIRPath py Documentation:
    https://github.com/beda-software/fhirpath-py?tab=readme-ov-file#fhirpathpy
    """

    model: NotRequired[Model]
    userInvocationTable: NotRequired[UserInvocationTable]
    cache: NotRequired["ExpressionCache"]


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
