from sqlalchemy import Connection

from src.database.client import fetch_one, fetch_val_or_none
from src.packages.sharing.schemas import ParticipantRecord, SharedAlbumRecord


def upsert_share_token(connection: Connection, album_id: int, token: str) -> None:
    """One statement, so generating and revoking are the same step: the old
    token stops existing as the new one starts, and two concurrent calls
    leave a single row."""
    fetch_val_or_none(
        connection,
        "INSERT INTO share_tokens (album_id, token) VALUES (:album_id, :token) "
        "ON CONFLICT (album_id) DO UPDATE SET "
        "token = excluded.token, created_at = CURRENT_TIMESTAMP "
        "RETURNING id",
        {"album_id": album_id, "token": token},
    )


def get_album_by_token(connection: Connection, token: str) -> SharedAlbumRecord | None:
    return fetch_one(
        connection,
        "SELECT a.id, a.title, "
        "(SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count "
        "FROM share_tokens s JOIN albums a ON a.id = s.album_id "
        "WHERE s.token = :token",
        SharedAlbumRecord,
        {"token": token},
    )


def get_participant(
    connection: Connection, album_id: int, token_hash: str
) -> ParticipantRecord | None:
    # Filtered by album: a cookie only identifies its participant in its own
    # album.
    return fetch_one(
        connection,
        "SELECT id, name FROM participants "
        "WHERE album_id = :album_id AND token_hash = :token_hash",
        ParticipantRecord,
        {"album_id": album_id, "token_hash": token_hash},
    )


def insert_participant(
    connection: Connection, album_id: int, name: str, token_hash: str
) -> ParticipantRecord:
    participant = fetch_one(
        connection,
        "INSERT INTO participants (album_id, name, token_hash) "
        "VALUES (:album_id, :name, :token_hash) RETURNING id, name",
        ParticipantRecord,
        {"album_id": album_id, "name": name, "token_hash": token_hash},
    )
    assert participant is not None
    return participant
