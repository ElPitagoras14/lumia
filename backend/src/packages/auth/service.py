"""The auth rules. Every function receives the connection it runs on and
knows nothing about HTTP, so the API, the startup seeding and the CLI all
share it.
"""

from sqlalchemy import Connection

from src.exceptions import NotFoundError, ValidationFailedError
from src.packages.auth import repository
from src.packages.auth.config import check_password_limits
from src.packages.auth.exceptions import InvalidCredentialsError
from src.packages.auth.schemas import UserRecord
from src.packages.auth.security import (
    generate_session_secret,
    hash_password,
    hash_session_secret,
    spend_password_check_time,
    verify_password,
)


def seed_owner(connection: Connection, email: str, password: str) -> bool:
    """Creates the owner only while there are no users at all. Once one
    exists nothing here touches it, so changing the configured password
    later does not change the account's; `reset_password` does.

    Returns whether it created the user.
    """
    if repository.count_users(connection) > 0:
        return False
    repository.insert_user(connection, email, hash_password(password))
    return True


def login(connection: Connection, email: str, password: str) -> tuple[UserRecord, str]:
    """Opens a new session next to any the user already has, and returns the
    user with the session's secret -- the only moment the secret exists in
    the clear; the database keeps just its hash.
    """
    credentials = repository.get_credentials_by_email(connection, email)
    if credentials is None:
        spend_password_check_time(password)
        raise InvalidCredentialsError()
    if not verify_password(password, credentials.password_hash):
        raise InvalidCredentialsError()

    repository.delete_expired_sessions_for_user(connection, credentials.id)
    secret = generate_session_secret()
    repository.insert_session(connection, credentials.id, hash_session_secret(secret))
    return UserRecord(id=credentials.id, email=credentials.email), secret


def resolve_session(connection: Connection, secret: str) -> UserRecord | None:
    """None for an unknown secret and for an expired session alike."""
    return repository.get_user_by_session(connection, hash_session_secret(secret))


def end_session(connection: Connection, secret: str) -> None:
    repository.delete_session(connection, hash_session_secret(secret))


def reset_password(connection: Connection, email: str, new_password: str) -> None:
    """Also closes every session the user had open, so whoever held one with
    the old password has to sign in again."""
    try:
        check_password_limits(new_password)
    except ValueError as exc:
        raise ValidationFailedError("password", str(exc)) from exc

    credentials = repository.get_credentials_by_email(connection, email)
    if credentials is None:
        raise NotFoundError()

    repository.update_password(connection, credentials.id, hash_password(new_password))
    repository.delete_sessions_for_user(connection, credentials.id)
