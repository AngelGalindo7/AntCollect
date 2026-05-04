from enum import Enum
from typing import Optional


class ErrorCode(str, Enum):
    VALIDATION = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    INTERNAL = "INTERNAL_ERROR"

    POST_IMAGE_FORMAT_UNSUPPORTED = "POST_IMAGE_FORMAT_UNSUPPORTED"
    POST_IMAGE_TYPE_REJECTED = "POST_IMAGE_TYPE_REJECTED"
    POST_IMAGE_CORRUPTED = "POST_IMAGE_CORRUPTED"
    POST_IMAGE_TOO_LARGE = "POST_IMAGE_TOO_LARGE"
    POST_PROCESSING_FAILED = "POST_PROCESSING_FAILED"


class AppError(Exception):
    """
    Raise from any router/utility to surface a structured error to the client.

    The single global handler in main.py turns this into the canonical error
    envelope: { "error": { "code", "message", "field", "request_id" } }.
    """

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        status: int = 400,
        field: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.field = field
