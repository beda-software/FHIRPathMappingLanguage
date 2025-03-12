from .constants import root_node_key
from .core_types import Path


class FPMLValidationError(Exception):
    """
    Exception raised for validation errors during FPML template resolving.

    Attributes:
        error_message (str): Description of the validation error.
        error_path (Path): Path in the resource where the error occurred.
    """

    error_message: str
    error_path: str

    def __init__(self, message: str, path: Path) -> None:
        """
        Initializes FPMLValidationError with an error message and path.

        Args:
            message (str): The error message describing the validation failure.
            path (Path): The path in the resource where the error occurred.
        """
        path_str = ".".join(str(x) for x in path if x != root_node_key)
        super().__init__(f"{message}. Path '{path_str}'")

        self.error_message = message
        self.error_path = path_str
