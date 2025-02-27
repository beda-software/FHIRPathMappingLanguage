from typing import Any, Callable, Optional, TypedDict, Union

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


class FPOptions(TypedDict):
    pass


class MatcherResult(TypedDict):
    node: Optional[Node]


Matcher = Callable[
    [
        Path,
        Resource,
        DictNode,
        Context,
        Optional[Model],
        Optional[FPOptions],
    ],
    Optional[MatcherResult],
]

Transformer = Callable[[Path, Node, Context], tuple[Node, Context]]
