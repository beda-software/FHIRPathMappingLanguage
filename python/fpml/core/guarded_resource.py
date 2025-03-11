from typing import Any


class GuardedResource(dict[str, Any]):
    """
    It's a special resource that does not allow accessing any of keys
    """

    def __getitem__(self, key: str) -> Any:
        raise KeyError(
            f"Forbidden access to resource property '{key}' in strict mode. Use context instead."
        )

    def get(self, key: str, _default: Any = None) -> Any:
        return self[key]


guarded_resource = GuardedResource()
