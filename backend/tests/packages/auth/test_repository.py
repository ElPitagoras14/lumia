from sqlalchemy import Connection, text

from src.packages.auth import repository
from src.packages.auth.schemas import CredentialsRecord, UserRecord


def _add_session(conn: Connection, user_id: int, token_hash: str, expires: str) -> None:
    """A session with an explicit expiry, written without the repository."""
    conn.execute(
        text(
            "INSERT INTO sessions (user_id, token_hash, expires_at) "
            "VALUES (:user_id, :token_hash, datetime('now', :expires))"
        ),
        {"user_id": user_id, "token_hash": token_hash, "expires": expires},
    )


def _session_count(conn: Connection, user_id: int) -> int:
    return conn.execute(
        text("SELECT COUNT(*) FROM sessions WHERE user_id = :user_id"),
        {"user_id": user_id},
    ).scalar_one()


def test_a_user_is_inserted_and_read_back(conn):
    before = repository.count_users(conn)

    user = repository.insert_user(conn, "ana@example.com", "hash-1")

    assert user == UserRecord(id=user.id, email="ana@example.com")
    assert repository.count_users(conn) == before + 1
    assert repository.get_credentials_by_email(conn, "ana@example.com") == (
        CredentialsRecord(id=user.id, email="ana@example.com", password_hash="hash-1")
    )


def test_the_email_lookup_ignores_case(conn):
    user = repository.insert_user(conn, "ana@example.com", "hash-1")

    found = repository.get_credentials_by_email(conn, "ANA@Example.COM")

    assert found is not None
    assert found.id == user.id


def test_an_unknown_email_is_none(conn):
    assert repository.get_credentials_by_email(conn, "nobody@example.com") is None


def test_the_password_hash_is_updated(conn):
    user = repository.insert_user(conn, "ana@example.com", "old")

    repository.update_password(conn, user.id, "new")

    found = repository.get_credentials_by_email(conn, "ana@example.com")
    assert found is not None
    assert found.password_hash == "new"


def test_a_session_is_inserted_and_resolves_to_its_user(conn):
    user = repository.insert_user(conn, "ana@example.com", "hash-1")

    repository.insert_session(conn, user.id, "token-hash")

    assert repository.get_user_by_session(conn, "token-hash") == user


def test_a_session_expires_30_days_after_it_is_inserted(conn):
    user = repository.insert_user(conn, "ana@example.com", "hash-1")

    repository.insert_session(conn, user.id, "token-hash")

    seconds_left = conn.execute(
        text(
            "SELECT (julianday(expires_at) - julianday('now')) * 86400 "
            "FROM sessions WHERE token_hash = 'token-hash'"
        )
    ).scalar_one()
    assert abs(seconds_left - 30 * 24 * 3600) < 5


def test_an_unknown_session_is_none(conn):
    assert repository.get_user_by_session(conn, "no-such-token") is None


def test_an_expired_session_is_not_resolved(conn):
    user = repository.insert_user(conn, "ana@example.com", "hash-1")
    _add_session(conn, user.id, "expired", "-1 minute")

    assert repository.get_user_by_session(conn, "expired") is None


def test_a_session_resolves_to_its_own_user_among_several(conn):
    ana = repository.insert_user(conn, "ana@example.com", "hash-1")
    luis = repository.insert_user(conn, "luis@example.com", "hash-2")
    repository.insert_session(conn, ana.id, "ana-token")
    repository.insert_session(conn, luis.id, "luis-token")

    assert repository.get_user_by_session(conn, "ana-token") == ana
    assert repository.get_user_by_session(conn, "luis-token") == luis


def test_deleting_one_session_leaves_the_others(conn):
    user = repository.insert_user(conn, "ana@example.com", "hash-1")
    repository.insert_session(conn, user.id, "phone")
    repository.insert_session(conn, user.id, "laptop")

    repository.delete_session(conn, "phone")

    assert repository.get_user_by_session(conn, "phone") is None
    assert repository.get_user_by_session(conn, "laptop") == user


def test_deleting_the_sessions_of_a_user_leaves_other_users_alone(conn):
    ana = repository.insert_user(conn, "ana@example.com", "hash-1")
    luis = repository.insert_user(conn, "luis@example.com", "hash-2")
    repository.insert_session(conn, ana.id, "ana-1")
    repository.insert_session(conn, ana.id, "ana-2")
    repository.insert_session(conn, luis.id, "luis-1")

    repository.delete_sessions_for_user(conn, ana.id)

    assert _session_count(conn, ana.id) == 0
    assert _session_count(conn, luis.id) == 1


def test_only_the_expired_sessions_of_a_user_are_deleted(conn):
    user = repository.insert_user(conn, "ana@example.com", "hash-1")
    other = repository.insert_user(conn, "luis@example.com", "hash-2")
    _add_session(conn, user.id, "old", "-1 minute")
    repository.insert_session(conn, user.id, "current")
    _add_session(conn, other.id, "others-old", "-1 minute")

    repository.delete_expired_sessions_for_user(conn, user.id)

    assert _session_count(conn, user.id) == 1
    assert repository.get_user_by_session(conn, "current") == user
    assert _session_count(conn, other.id) == 1
