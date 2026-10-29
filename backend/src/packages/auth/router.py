from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response

from src.database.dependencies import DbConnection
from src.packages.auth import service
from src.packages.auth.config import (
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_PATH,
    SESSION_LIFETIME,
)
from src.packages.auth.dependencies import current_user
from src.packages.auth.responses import CurrentUserResponse
from src.packages.auth.schemas import LoginRequest, UserRecord
from src.responses import Envelope

router = APIRouter(prefix="/auth")

# No `secure`: 0.1.0 is served over plain HTTP, where a Secure cookie would
# silently never come back. SameSite=Lax is what keeps another site's POST
# from carrying it.


@router.post("/login")
def login(
    body: LoginRequest, response: Response, connection: DbConnection
) -> Envelope[CurrentUserResponse]:
    user, secret = service.login(connection, body.email, body.password)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=secret,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        samesite="lax",
        path=SESSION_COOKIE_PATH,
    )
    return Envelope(data=CurrentUserResponse.from_record(user))


@router.post("/logout")
def logout(
    response: Response,
    connection: DbConnection,
    secret: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> Envelope[None]:
    """A write, not a read: with SameSite=Lax cookies, a read endpoint could
    be triggered by an embed on another site -- this can't be, because
    nothing but an explicit POST reaches it. Succeeds without a session too,
    since the caller's goal, not having one, is already met.
    """
    if secret is not None:
        service.end_session(connection, secret)
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        path=SESSION_COOKIE_PATH,
        httponly=True,
        samesite="lax",
    )
    return Envelope(data=None)


@router.get("/me")
def me(
    user: Annotated[UserRecord, Depends(current_user)],
) -> Envelope[CurrentUserResponse]:
    return Envelope(data=CurrentUserResponse.from_record(user))
