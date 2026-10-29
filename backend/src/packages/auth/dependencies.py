from typing import Annotated

from fastapi import Cookie, Depends

from src.database.dependencies import DbConnection
from src.exceptions import UnauthenticatedError
from src.packages.auth import service
from src.packages.auth.config import SESSION_COOKIE_NAME
from src.packages.auth.schemas import UserRecord


def require_session_cookie(
    secret: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> str:
    """A sub-dependency of its own, not a plain check inside `current_user`'s
    body: FastAPI resolves a function's dependencies in the order they are
    declared and stops at the first one that raises, so declaring this one
    before the connection is what keeps a cookie-less request from ever
    taking a connection.
    """
    if secret is None:
        raise UnauthenticatedError()
    return secret


def current_user(
    secret: Annotated[str, Depends(require_session_cookie)],
    connection: DbConnection,
) -> UserRecord:
    """The only way an owner route learns who is asking. Without a valid
    session this raises before the route's own code runs; an expired session
    is treated exactly like a missing one.
    """
    user = service.resolve_session(connection, secret)
    if user is None:
        raise UnauthenticatedError()
    return user
