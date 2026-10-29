import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.exceptions import (
    DatabaseError,
    ForbiddenError,
    NotFoundError,
    StateConflictError,
    UnauthenticatedError,
    ValidationFailedError,
)
from src.packages.auth.exceptions import InvalidCredentialsError
from src.responses import error_envelope


async def _database_error_handler(request: Request, exc: DatabaseError) -> JSONResponse:
    """No trace of the query, the driver, or table and column names."""
    return JSONResponse(
        status_code=503,
        content=error_envelope(
            "service_unavailable", "the service is temporarily unavailable"
        ),
    )


async def _unauthenticated_handler(
    request: Request, exc: UnauthenticatedError
) -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content=error_envelope("unauthenticated", "authentication is required"),
    )


async def _invalid_credentials_handler(
    request: Request, exc: InvalidCredentialsError
) -> JSONResponse:
    # One message for a wrong password and for an unknown email.
    return JSONResponse(
        status_code=401,
        content=error_envelope("invalid_credentials", "invalid email or password"),
    )


async def _forbidden_handler(request: Request, exc: ForbiddenError) -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content=error_envelope("forbidden", "you are not allowed to do that"),
    )


async def _not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content=error_envelope("not_found", "the requested resource does not exist"),
    )


async def _validation_failed_handler(
    request: Request, exc: ValidationFailedError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_envelope("validation_failed", exc.message, field=exc.field),
    )


async def _state_conflict_handler(
    request: Request, exc: StateConflictError
) -> JSONResponse:
    """409, never 422: the status alone tells a client this apart, since
    nothing here names an invalid field."""
    return JSONResponse(
        status_code=409,
        content=error_envelope(exc.code, exc.message, details=exc.details),
    )


async def _request_validation_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """FastAPI's own validation failure, reshaped into this project's
    envelope instead of its default body."""
    first_error = exc.errors()[0]
    field = ".".join(str(part) for part in first_error["loc"] if part != "body")
    return JSONResponse(
        status_code=422,
        content=error_envelope(
            "validation_failed", first_error["msg"], field=field or None
        ),
    )


async def _http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Including the framework's own 404 for an unmatched route, so even
    those come back in this project's shape."""
    return JSONResponse(
        status_code=exc.status_code,
        content=error_envelope("http_error", str(exc.detail)),
    )


async def _unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Generic, carrying an id that identifies the logged detail rather than
    the exception's message, traceback or origin."""
    request_id = str(uuid.uuid4())
    logger.opt(exception=exc).error(f"unhandled error, request_id={request_id}")
    return JSONResponse(
        status_code=500,
        content=error_envelope(
            "internal_error", "an unexpected error occurred", request_id=request_id
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DatabaseError, _database_error_handler)
    app.add_exception_handler(UnauthenticatedError, _unauthenticated_handler)
    app.add_exception_handler(InvalidCredentialsError, _invalid_credentials_handler)
    app.add_exception_handler(ForbiddenError, _forbidden_handler)
    app.add_exception_handler(NotFoundError, _not_found_handler)
    app.add_exception_handler(ValidationFailedError, _validation_failed_handler)
    app.add_exception_handler(StateConflictError, _state_conflict_handler)
    app.add_exception_handler(RequestValidationError, _request_validation_handler)
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    # Last, so anything without a handler of its own lands here instead of
    # a bare 500. Starlette resolves by the exception's MRO, not by order.
    app.add_exception_handler(Exception, _unhandled_error_handler)
