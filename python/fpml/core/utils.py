from typing import Any, Optional


def flatten(lst: list):
    result = []
    for item in lst:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result


def omit_key(obj: dict[str, Any], key: Optional[str]) -> dict[str, Any]:
    if key is None:
        return obj
    return {k: v for k, v in obj.items() if k != key}
