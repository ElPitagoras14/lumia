from sqlalchemy import Connection

from src.database.client import fetch_all, fetch_one, fetch_val_or_none
from src.packages.albums.schemas import AlbumRecord, StorageKeyRecord

# Every query takes the owner and filters by it: no function here can reach
# an album without saying whose it must be.

_ALBUM_COLUMNS = """
    a.id,
    a.title,
    a.created_at,
    (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS photo_count,
    (SELECT p.storage_key FROM photos p WHERE p.album_id = a.id
        ORDER BY p.id LIMIT 1) AS cover_key,
    (SELECT s.token FROM share_tokens s WHERE s.album_id = a.id) AS share_token,
    (SELECT COUNT(*) FROM participants pa WHERE pa.album_id = a.id)
        AS participant_count
"""


def insert_album(connection: Connection, owner_id: int, title: str) -> AlbumRecord:
    album_id = fetch_val_or_none(
        connection,
        "INSERT INTO albums (owner_id, title) VALUES (:owner_id, :title) RETURNING id",
        {"owner_id": owner_id, "title": title},
    )
    album = get_album(connection, album_id, owner_id)
    assert album is not None
    return album


def list_albums(connection: Connection, owner_id: int) -> list[AlbumRecord]:
    # Newest first; the id is the tie-break the one-second timestamp lacks.
    return fetch_all(
        connection,
        f"SELECT {_ALBUM_COLUMNS} FROM albums a "
        "WHERE a.owner_id = :owner_id ORDER BY a.id DESC",
        AlbumRecord,
        {"owner_id": owner_id},
    )


def get_album(
    connection: Connection, album_id: int, owner_id: int
) -> AlbumRecord | None:
    return fetch_one(
        connection,
        f"SELECT {_ALBUM_COLUMNS} FROM albums a "
        "WHERE a.id = :album_id AND a.owner_id = :owner_id",
        AlbumRecord,
        {"album_id": album_id, "owner_id": owner_id},
    )


def list_storage_keys(connection: Connection, album_id: int) -> list[str]:
    rows = fetch_all(
        connection,
        "SELECT storage_key FROM photos WHERE album_id = :album_id",
        StorageKeyRecord,
        {"album_id": album_id},
    )
    return [row.storage_key for row in rows]


def delete_album(connection: Connection, album_id: int, owner_id: int) -> bool:
    deleted = fetch_val_or_none(
        connection,
        "DELETE FROM albums WHERE id = :album_id AND owner_id = :owner_id RETURNING id",
        {"album_id": album_id, "owner_id": owner_id},
    )
    return deleted is not None
