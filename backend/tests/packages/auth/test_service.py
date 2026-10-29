from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import Connection, create_engine, text

from src.exceptions import NotFoundError, ValidationFailedError
from src.packages.auth import repository, service
from src.packages.auth.exceptions import InvalidCredentialsError
from src.packages.auth.security import hash_password, hash_session_secret
from tests.migrate import run_dbmate

PASSWORD = "correct-password"
# Hashing is deliberately slow, so it is done once for every user the tests
# create instead of once per user.
PASSWORD_HASH = hash_password(PASSWORD)


def _user(conn: Connection, email: str = "ana@example.com"):
    return repository.insert_user(conn, email, PASSWORD_HASH)


def _session_rows(conn: Connection, user_id: int) -> list[dict]:
    rows = conn.execute(
        text("SELECT * FROM sessions WHERE user_id = :user_id"), {"user_id": user_id}
    )
    return [dict(row) for row in rows.mappings()]


# --- login ---


def test_login_with_the_right_password_returns_the_user_and_a_secret(conn):
    user = _user(conn)

    logged_in, secret = service.login(conn, "ana@example.com", PASSWORD)

    assert logged_in == user
    assert secret


def test_login_ignores_the_case_of_the_email(conn):
    user = _user(conn)

    logged_in, _ = service.login(conn, "ANA@Example.com", PASSWORD)

    assert logged_in == user


def test_login_with_a_wrong_password_fails_and_opens_no_session(conn):
    user = _user(conn)

    with pytest.raises(InvalidCredentialsError):
        service.login(conn, "ana@example.com", "wrong-password")

    assert _session_rows(conn, user.id) == []


def test_login_with_an_unknown_email_fails(conn):
    with pytest.raises(InvalidCredentialsError):
        service.login(conn, "nobody@example.com", PASSWORD)


def test_an_unknown_email_still_spends_the_time_of_a_password_check(conn, monkeypatch):
    spent: list[str] = []
    monkeypatch.setattr(service, "spend_password_check_time", spent.append)

    with pytest.raises(InvalidCredentialsError):
        service.login(conn, "nobody@example.com", PASSWORD)

    assert spent == [PASSWORD]


def test_a_password_over_72_bytes_is_just_incorrect(conn):
    _user(conn)

    with pytest.raises(InvalidCredentialsError):
        service.login(conn, "ana@example.com", "a" * 73)


def test_the_session_row_holds_the_hash_of_the_secret_and_never_the_secret(conn):
    user = _user(conn)

    _, secret = service.login(conn, "ana@example.com", PASSWORD)

    (row,) = _session_rows(conn, user.id)
    assert row["token_hash"] == hash_session_secret(secret)
    assert secret not in [str(value) for value in row.values()]


def test_each_login_opens_its_own_session(conn):
    user = _user(conn)

    _, phone = service.login(conn, "ana@example.com", PASSWORD)
    _, laptop = service.login(conn, "ana@example.com", PASSWORD)

    assert phone != laptop
    assert len(_session_rows(conn, user.id)) == 2


def test_login_deletes_the_expired_sessions_of_that_user_only(conn):
    ana = _user(conn)
    luis = _user(conn, "luis@example.com")
    for user in (ana, luis):
        conn.execute(
            text(
                "INSERT INTO sessions (user_id, token_hash, expires_at) "
                "VALUES (:user_id, :token_hash, datetime('now', '-1 minute'))"
            ),
            {"user_id": user.id, "token_hash": f"expired-{user.id}"},
        )

    service.login(conn, "ana@example.com", PASSWORD)

    ana_hashes = [row["token_hash"] for row in _session_rows(conn, ana.id)]
    assert f"expired-{ana.id}" not in ana_hashes
    assert len(_session_rows(conn, luis.id)) == 1


# --- sessions ---


def test_a_secret_resolves_to_its_user(conn):
    user = _user(conn)
    _, secret = service.login(conn, "ana@example.com", PASSWORD)

    assert service.resolve_session(conn, secret) == user


def test_an_unknown_secret_resolves_to_nobody(conn):
    assert service.resolve_session(conn, "not-a-session") is None


def test_an_expired_session_resolves_to_nobody(conn):
    user = _user(conn)
    conn.execute(
        text(
            "INSERT INTO sessions (user_id, token_hash, expires_at) "
            "VALUES (:user_id, :token_hash, datetime('now', '-1 minute'))"
        ),
        {"user_id": user.id, "token_hash": hash_session_secret("old-secret")},
    )

    assert service.resolve_session(conn, "old-secret") is None


def test_ending_one_session_leaves_the_others_open(conn):
    user = _user(conn)
    _, phone = service.login(conn, "ana@example.com", PASSWORD)
    _, laptop = service.login(conn, "ana@example.com", PASSWORD)

    service.end_session(conn, phone)

    assert service.resolve_session(conn, phone) is None
    assert service.resolve_session(conn, laptop) == user


def test_ending_a_session_that_does_not_exist_is_harmless(conn):
    service.end_session(conn, "not-a-session")


# --- reset_password ---


def test_reset_password_changes_it_and_closes_every_session(conn):
    user = _user(conn)
    _, secret = service.login(conn, "ana@example.com", PASSWORD)

    service.reset_password(conn, "ana@example.com", "a-new-password")

    assert service.resolve_session(conn, secret) is None
    assert service.login(conn, "ana@example.com", "a-new-password")[0] == user
    with pytest.raises(InvalidCredentialsError):
        service.login(conn, "ana@example.com", PASSWORD)


def test_reset_password_leaves_other_users_sessions_open(conn):
    _user(conn)
    luis = _user(conn, "luis@example.com")
    _, luis_secret = service.login(conn, "luis@example.com", PASSWORD)

    service.reset_password(conn, "ana@example.com", "a-new-password")

    assert service.resolve_session(conn, luis_secret) == luis


def test_reset_password_for_an_unknown_email_changes_nothing(conn):
    with pytest.raises(NotFoundError):
        service.reset_password(conn, "nobody@example.com", "a-new-password")


@pytest.mark.parametrize("password", ["1234567", "a" * 73])
def test_reset_password_rejects_a_password_outside_the_limits(conn, password):
    _user(conn)
    _, secret = service.login(conn, "ana@example.com", PASSWORD)

    with pytest.raises(ValidationFailedError) as error:
        service.reset_password(conn, "ana@example.com", password)

    assert error.value.field == "password"
    assert service.resolve_session(conn, secret) is not None
    service.login(conn, "ana@example.com", PASSWORD)


# --- seeding ---


@pytest.fixture(scope="module")
def empty_database(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A database migrated like production and never written to, apart from
    what a test does inside a transaction it rolls back."""
    data_dir = tmp_path_factory.mktemp("seed")
    run_dbmate(data_dir)
    return data_dir / "lumia.db"


@pytest.fixture
def fresh(empty_database: Path) -> Iterator[Connection]:
    engine = create_engine(f"sqlite:///{empty_database}")
    with engine.connect() as connection:
        connection.begin()
        yield connection
        connection.rollback()
    engine.dispose()


def test_first_start_creates_the_owner_with_the_configured_credentials(fresh):
    created = service.seed_owner(fresh, "owner@example.com", "seed-password")

    assert created is True
    assert repository.count_users(fresh) == 1
    user, _ = service.login(fresh, "owner@example.com", "seed-password")
    assert user.email == "owner@example.com"


def test_a_later_start_with_another_password_changes_nothing(fresh):
    service.seed_owner(fresh, "owner@example.com", "seed-password")

    created = service.seed_owner(fresh, "owner@example.com", "another-password")

    assert created is False
    assert repository.count_users(fresh) == 1
    service.login(fresh, "owner@example.com", "seed-password")
    with pytest.raises(InvalidCredentialsError):
        service.login(fresh, "owner@example.com", "another-password")


def test_a_later_start_with_another_email_creates_no_second_user(fresh):
    service.seed_owner(fresh, "owner@example.com", "seed-password")

    assert service.seed_owner(fresh, "other@example.com", "seed-password") is False
    assert repository.count_users(fresh) == 1


def test_seeding_is_skipped_when_any_user_already_exists(fresh):
    repository.insert_user(fresh, "ana@example.com", PASSWORD_HASH)

    assert service.seed_owner(fresh, "owner@example.com", "seed-password") is False
    assert repository.get_credentials_by_email(fresh, "owner@example.com") is None


def test_the_seeded_password_is_not_stored_in_the_clear(fresh):
    service.seed_owner(fresh, "owner@example.com", "seed-password")

    credentials = repository.get_credentials_by_email(fresh, "owner@example.com")

    assert credentials is not None
    assert "seed-password" not in credentials.password_hash
