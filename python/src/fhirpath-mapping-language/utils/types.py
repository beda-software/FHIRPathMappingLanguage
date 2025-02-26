from typing import Any, TypedDict


type Resource = dict[str, Any]
type Context = dict[str, Any] | None


class Model(TypedDict):
    choiceTypePaths: dict[str, list[str]]
    pathsDefinedElsewhere: dict[str, str]
    type2Parent: dict[str, str]
    path2Type: dict[str, str]

class UserInvocationTable:
    pass
