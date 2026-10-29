from sqlalchemy import Connection

from src.database.client import fetch_one, fetch_val, write
from src.packages.auth.config import SESSION_LIFETIME
from src.packages.auth.schemas import CredentialsRecord, UserRecord

# Dates are computed by SQLite, in UTC and in the `YYYY-MM-DD HH:MM:SS` format
# the schema's own defaults use, so comparing them as text compares them as
# dates. `users.email` is NOCASE, so every email comparison ignores case.

_SESSION_LIFETIME_MODIFIER = f"+{int(SESSION_LIFETIME.total_seconds())} seconds"


def count_users(connection: Connection) -> int:
    return fetch_val(connection, "SELECT COUNT(*) FROM users")


def insert_user(connection: Connection, email: str, password_hash: str) -> UserRecord:
    user = fetch_one(
        connection,
        """
        INSERT INTO users (email, password_hash)
        VALUES (:email, :password_hash)
        RETURNING id, email
        """,
        UserRecord,
        {"email": email, "password_hash": password_hash},
    )
    assert user is not None
    return user


def get_credentials_by_email(
    connection: Connection, email: str
) -> CredentialsRecord | None:
    return fetch_one(
        connection,
        "SELECT id, email, password_hash FROM users WHERE email = :email",
        CredentialsRecord,
        {"email": email},
    )


def update_password(connection: Connection, user_id: int, password_hash: str) -> None:
    write(
        connection,
        "UPDATE users SET password_hash = :password_hash WHERE id = :user_id",
        {"user_id": user_id, "password_hash": password_hash},
    )


def insert_session(connection: Connection, user_id: int, token_hash: str) -> None:
    write(
        connection,
        """
        INSERT INTO sessions (user_id, token_hash, expires_at)
        VALUES (:user_id, :token_hash, datetime('now', :lifetime))
        """,
        {
            "user_id": user_id,
            "token_hash": token_hash,
            "lifetime": _SESSION_LIFETIME_MODIFIER,
        },
    )


def get_user_by_session(connection: Connection, token_hash: str) -> UserRecord | None:
    """An expired session is not returned, exactly as if it did not exist."""
    return fetch_one(
        connection,
        """
        SELECT u.id, u.email
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = :token_hash AND s.expires_at > CURRENT_TIMESTAMP
        """,
        UserRecord,
        {"token_hash": token_hash},
    )


def delete_session(connection: Connection, token_hash: str) -> None:
    write(
        connection,
        "DELETE FROM sessions WHERE token_hash = :token_hash",
        {"token_hash": token_hash},
    )


def delete_sessions_for_user(connection: Connection, user_id: int) -> None:
    write(
        connection,
        "DELETE FROM sessions WHERE user_id = :user_id",
        {"user_id": user_id},
    )


def delete_expired_sessions_for_user(connection: Connection, user_id: int) -> None:
    """Housekeeping, not correctness: an expired row never authenticates
    regardless of whether it was ever deleted."""
    write(
        connection,
        """
        DELETE FROM sessions
        WHERE user_id = :user_id AND expires_at <= CURRENT_TIMESTAMP
        """,
        {"user_id": user_id},
    )
