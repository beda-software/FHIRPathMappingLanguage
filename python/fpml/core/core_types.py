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


Evaluate = Callable[[Resource, str, Context], list[Any]]


class MatcherResult(TypedDict):
    node: Optional[Node]


Matcher = Callable[
    [
        Path,
        Resource,
        DictNode,
        Context,
        Evaluate,
    ],
    Optional[MatcherResult],
]

Transformer = Callable[[Path, Node, Context], tuple[Node, Context]]
