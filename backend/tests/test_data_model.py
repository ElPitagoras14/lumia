"""Integrity rules the schema itself enforces (spec data-model).

Each test runs inside a transaction that is rolled back afterwards, on a
connection from the app's engine, so foreign keys are on exactly as in
production. A rejected statement aborts only itself, not the transaction.
"""

from collections.abc import Iterator

import pytest
from sqlalchemy import Connection, text
from sqlalchemy.exc import IntegrityError

from src.database.client import engine


@pytest.fixture
def conn() -> Iterator[Connection]:
    with engine.connect() as connection:
        connection.begin()
        yield connection
        connection.rollback()


def _insert(conn: Connection, sql: str, **params: object) -> int:
    return conn.execute(text(sql + " RETURNING id"), params).scalar_one()


def _user(conn: Connection, email: str = "ana@example.com") -> int:
    return _insert(
        conn,
        "INSERT INTO users (email, password_hash) VALUES (:email, 'x')",
        email=email,
    )


def _album(conn: Connection, owner_id: int, title: str = "Viaje") -> int:
    return _insert(
        conn,
        "INSERT INTO albums (owner_id, title) VALUES (:owner_id, :title)",
        owner_id=owner_id,
        title=title,
    )


def _photo(
    conn: Connection,
    album_id: int,
    storage_key: str,
    content_type: str = "image/jpeg",
) -> int:
    return _insert(
        conn,
        "INSERT INTO photos (album_id, storage_key, content_type, size_bytes) "
        "VALUES (:album_id, :storage_key, :content_type, 1024)",
        album_id=album_id,
        storage_key=storage_key,
        content_type=content_type,
    )


def _participant(
    conn: Connection, album_id: int, token_hash: str, name: str = "Ana"
) -> int:
    return _insert(
        conn,
        "INSERT INTO participants (album_id, name, token_hash) "
        "VALUES (:album_id, :name, :token_hash)",
        album_id=album_id,
        name=name,
        token_hash=token_hash,
    )


def _rate(
    conn: Connection,
    photo_id: int,
    participant_id: int,
    album_id: int,
    approved: int = 1,
) -> None:
    conn.execute(
        text(
            "INSERT INTO ratings (photo_id, participant_id, album_id, approved) "
            "VALUES (:photo_id, :participant_id, :album_id, :approved)"
        ),
        {
            "photo_id": photo_id,
            "participant_id": participant_id,
            "album_id": album_id,
            "approved": approved,
        },
    )


def _session(conn: Connection, user_id: int, token_hash: str) -> None:
    conn.execute(
        text(
            "INSERT INTO sessions (user_id, token_hash, expires_at) "
            "VALUES (:user_id, :token_hash, '2099-01-01 00:00:00')"
        ),
        {"user_id": user_id, "token_hash": token_hash},
    )


def _count(conn: Connection, table: str) -> int:
    return conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one()


# --- Rollback isolation: both tests insert the same email ------------------


@pytest.mark.parametrize("_run", [1, 2])
def test_each_test_starts_from_an_empty_schema(conn, _run):
    assert _count(conn, "users") == 0
    _user(conn)


# --- Users and album ownership ---------------------------------------------


def test_album_with_a_missing_owner_is_rejected(conn):
    with pytest.raises(IntegrityError):
        _album(conn, owner_id=999)


def test_user_with_albums_cannot_be_deleted(conn):
    user_id = _user(conn)
    _album(conn, user_id)

    with pytest.raises(IntegrityError):
        conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})

    assert _count(conn, "users") == 1
    assert _count(conn, "albums") == 1


def test_email_is_unique_regardless_of_case(conn):
    _user(conn, "ana@example.com")

    with pytest.raises(IntegrityError):
        _user(conn, "Ana@Example.com")


def test_filtering_by_owner_returns_only_their_albums(conn):
    ana = _user(conn, "ana@example.com")
    bea = _user(conn, "bea@example.com")
    ana_album = _album(conn, ana)
    _album(conn, bea)

    rows = conn.execute(
        text("SELECT id FROM albums WHERE owner_id = :owner_id"), {"owner_id": ana}
    ).scalars()

    assert list(rows) == [ana_album]


# --- Sessions --------------------------------------------------------------


def test_session_token_hash_is_unique(conn):
    user_id = _user(conn)
    _session(conn, user_id, "hash")

    with pytest.raises(IntegrityError):
        _session(conn, user_id, "hash")


def test_session_without_expiry_is_rejected(conn):
    user_id = _user(conn)

    with pytest.raises(IntegrityError):
        conn.execute(
            text("INSERT INTO sessions (user_id, token_hash) VALUES (:id, 'h')"),
            {"id": user_id},
        )


def test_deleting_a_user_deletes_their_sessions(conn):
    user_id = _user(conn)
    _session(conn, user_id, "a")
    _session(conn, user_id, "b")

    conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})

    assert _count(conn, "sessions") == 0


def test_tables_never_store_a_cookie_secret_in_clear(conn):
    for table in ("sessions", "participants"):
        columns = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
        assert "token_hash" in columns
        assert "token" not in columns


# --- Photos ----------------------------------------------------------------


def test_unsupported_content_type_is_rejected(conn):
    album_id = _album(conn, _user(conn))

    with pytest.raises(IntegrityError):
        _photo(conn, album_id, "k1", content_type="image/heic")


def test_storage_key_is_unique_across_albums(conn):
    user_id = _user(conn)
    _photo(conn, _album(conn, user_id), "same-key")

    with pytest.raises(IntegrityError):
        _photo(conn, _album(conn, user_id), "same-key")


def test_ordering_by_id_returns_upload_order(conn):
    album_id = _album(conn, _user(conn))
    uploaded = [_photo(conn, album_id, key) for key in ("a", "b", "c")]

    rows = conn.execute(
        text("SELECT storage_key FROM photos WHERE album_id = :id ORDER BY id"),
        {"id": album_id},
    ).scalars()

    assert list(rows) == ["a", "b", "c"]
    assert uploaded == sorted(uploaded)


# --- Share links -----------------------------------------------------------


def _share(conn: Connection, album_id: int, token: str) -> None:
    conn.execute(
        text("INSERT INTO share_tokens (album_id, token) VALUES (:id, :token)"),
        {"id": album_id, "token": token},
    )


def test_album_cannot_have_a_second_link(conn):
    album_id = _album(conn, _user(conn))
    _share(conn, album_id, "t1")

    with pytest.raises(IntegrityError):
        _share(conn, album_id, "t2")


def test_link_token_is_unique_across_albums(conn):
    user_id = _user(conn)
    _share(conn, _album(conn, user_id), "same")

    with pytest.raises(IntegrityError):
        _share(conn, _album(conn, user_id), "same")


@pytest.mark.parametrize(
    "revoke",
    [
        "DELETE FROM share_tokens WHERE album_id = :id",
        "UPDATE share_tokens SET token = 'new' WHERE album_id = :id",
    ],
)
def test_revoking_the_link_keeps_participants_and_votes(conn, revoke):
    album_id = _album(conn, _user(conn))
    _share(conn, album_id, "old")
    participant_id = _participant(conn, album_id, "p")
    _rate(conn, _photo(conn, album_id, "k"), participant_id, album_id)

    conn.execute(text(revoke), {"id": album_id})

    assert _count(conn, "participants") == 1
    assert _count(conn, "ratings") == 1


# --- Participants ----------------------------------------------------------


@pytest.mark.parametrize("name", ["", "   ", "x" * 51])
def test_invalid_participant_name_is_rejected(conn, name):
    album_id = _album(conn, _user(conn))

    with pytest.raises(IntegrityError):
        _participant(conn, album_id, "p", name=name)


def test_same_name_in_the_same_album_is_two_participants(conn):
    album_id = _album(conn, _user(conn))

    first = _participant(conn, album_id, "p1", name="Ana")
    second = _participant(conn, album_id, "p2", name="Ana")

    assert first != second


# --- Ratings ---------------------------------------------------------------


def test_second_vote_for_the_same_pair_is_rejected(conn):
    album_id = _album(conn, _user(conn))
    photo_id = _photo(conn, album_id, "k")
    participant_id = _participant(conn, album_id, "p")
    _rate(conn, photo_id, participant_id, album_id)

    with pytest.raises(IntegrityError):
        _rate(conn, photo_id, participant_id, album_id, approved=0)


def test_vote_across_albums_is_rejected(conn):
    user_id = _user(conn)
    album_x = _album(conn, user_id)
    album_y = _album(conn, user_id)
    participant_id = _participant(conn, album_x, "p")
    photo_y = _photo(conn, album_y, "k")

    # Neither album makes the pair consistent.
    for album_id in (album_x, album_y):
        with pytest.raises(IntegrityError):
            _rate(conn, photo_y, participant_id, album_id)


def test_non_binary_vote_is_rejected(conn):
    album_id = _album(conn, _user(conn))
    photo_id = _photo(conn, album_id, "k")
    participant_id = _participant(conn, album_id, "p")

    with pytest.raises(IntegrityError):
        _rate(conn, photo_id, participant_id, album_id, approved=2)


def test_changing_a_vote_replaces_it(conn):
    album_id = _album(conn, _user(conn))
    photo_id = _photo(conn, album_id, "k")
    participant_id = _participant(conn, album_id, "p")
    _rate(conn, photo_id, participant_id, album_id, approved=1)

    conn.execute(
        text(
            "INSERT INTO ratings (photo_id, participant_id, album_id, approved) "
            "VALUES (:photo_id, :participant_id, :album_id, 0) "
            "ON CONFLICT (photo_id, participant_id) DO UPDATE "
            "SET approved = excluded.approved, updated_at = CURRENT_TIMESTAMP"
        ),
        {"photo_id": photo_id, "participant_id": participant_id, "album_id": album_id},
    )

    rows = conn.execute(text("SELECT approved FROM ratings")).scalars()
    assert list(rows) == [0]


# --- Cascades --------------------------------------------------------------


def test_deleting_an_album_deletes_everything_under_it(conn):
    user_id = _user(conn)
    album_id = _album(conn, user_id)
    _share(conn, album_id, "t")
    participant_id = _participant(conn, album_id, "p")
    _rate(conn, _photo(conn, album_id, "k"), participant_id, album_id)

    conn.execute(text("DELETE FROM albums WHERE id = :id"), {"id": album_id})

    for table in ("photos", "share_tokens", "participants", "ratings"):
        assert _count(conn, table) == 0, table


def test_deleting_a_photo_deletes_only_its_votes(conn):
    album_id = _album(conn, _user(conn))
    deleted = _photo(conn, album_id, "k1")
    kept = _photo(conn, album_id, "k2")
    for token in ("p1", "p2"):
        participant_id = _participant(conn, album_id, token)
        _rate(conn, deleted, participant_id, album_id)
        _rate(conn, kept, participant_id, album_id)

    conn.execute(text("DELETE FROM photos WHERE id = :id"), {"id": deleted})

    rows = conn.execute(text("SELECT DISTINCT photo_id FROM ratings")).scalars()
    assert list(rows) == [kept]


def test_deleting_a_participant_deletes_only_their_votes(conn):
    album_id = _album(conn, _user(conn))
    photo_id = _photo(conn, album_id, "k")
    deleted = _participant(conn, album_id, "p1")
    kept = _participant(conn, album_id, "p2")
    _rate(conn, photo_id, deleted, album_id)
    _rate(conn, photo_id, kept, album_id)

    conn.execute(text("DELETE FROM participants WHERE id = :id"), {"id": deleted})

    rows = conn.execute(text("SELECT participant_id FROM ratings")).scalars()
    assert list(rows) == [kept]
