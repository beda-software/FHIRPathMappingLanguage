import importlib.metadata

from .core.core_exceptions import FPMLValidationError
from .core.extract import resolve_template

__title__ = "fpml"
__version__ = importlib.metadata.version("fpml")
__author__ = "beda.software"
__license__ = "MIT"
__copyright__ = "Copyright 2025 beda.software"

__all__ = ["FPMLValidationError", "resolve_template"]
