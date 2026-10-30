from sqlalchemy import Connection

from src.database.client import fetch_all, fetch_one, fetch_val_or_none
from src.packages.sharing.schemas import (
    GuestPhotoRecord,
    ParticipantRecord,
    SharedAlbumRecord,
)


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


def list_guest_photos(
    connection: Connection, album_id: int, participant_id: int
) -> list[GuestPhotoRecord]:
    # The join is filtered by participant, so other people's votes never
    # leave the database. Upload order is the id order.
    return fetch_all(
        connection,
        "SELECT p.id, p.storage_key, r.approved "
        "FROM photos p LEFT JOIN ratings r "
        "ON r.photo_id = p.id AND r.participant_id = :participant_id "
        "WHERE p.album_id = :album_id ORDER BY p.id",
        GuestPhotoRecord,
        {"album_id": album_id, "participant_id": participant_id},
    )


def upsert_rating(
    connection: Connection,
    album_id: int,
    participant_id: int,
    photo_id: int,
    approved: bool,
) -> GuestPhotoRecord | None:
    """One statement, so checking that the photo belongs to the album and
    writing the vote cannot race. A photo that does not exist or belongs to
    another album selects no row: nothing is written and the result is
    `None`. The `WHERE` on the `SELECT` also keeps SQLite from reading
    `ON CONFLICT` as part of a join."""
    voted = fetch_val_or_none(
        connection,
        "INSERT INTO ratings (photo_id, participant_id, album_id, approved) "
        "SELECT p.id, :participant_id, p.album_id, :approved "
        "FROM photos p WHERE p.id = :photo_id AND p.album_id = :album_id "
        "ON CONFLICT (photo_id, participant_id) DO UPDATE SET "
        "approved = excluded.approved, updated_at = CURRENT_TIMESTAMP "
        "RETURNING photo_id",
        {
            "album_id": album_id,
            "participant_id": participant_id,
            "photo_id": photo_id,
            "approved": int(approved),
        },
    )
    if voted is None:
        return None
    return fetch_one(
        connection,
        "SELECT p.id, p.storage_key, r.approved "
        "FROM photos p JOIN ratings r "
        "ON r.photo_id = p.id AND r.participant_id = :participant_id "
        "WHERE p.id = :photo_id",
        GuestPhotoRecord,
        {"photo_id": photo_id, "participant_id": participant_id},
    )
