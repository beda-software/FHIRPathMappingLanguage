
from .types import Path
from .constants import root_node_key

class FPMLValidationError(Exception):
    def __init__(self, message: str, path: Path) -> None:
        path_str = ".".join(str(x) for x in path if x != root_node_key)
        super().__init__(f"{message}. Path '{path_str}'")

        self.error_message = message
        self.error_path = path_str

