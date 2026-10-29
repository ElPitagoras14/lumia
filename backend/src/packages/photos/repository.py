from sqlalchemy import Connection

from src.database.client import fetch_all, fetch_one, fetch_val
from src.packages.photos.schemas import PhotoKeyRecord, PhotoRecord

_PHOTO_COLUMNS = "id, storage_key, size_bytes, created_at"


def count_photos(connection: Connection, album_id: int) -> int:
    return fetch_val(
        connection,
        "SELECT COUNT(*) FROM photos WHERE album_id = :album_id",
        {"album_id": album_id},
    )


def insert_photo(
    connection: Connection,
    album_id: int,
    storage_key: str,
    content_type: str,
    size_bytes: int,
    limit: int,
) -> PhotoRecord | None:
    """The count and the insert are one statement, so two uploads arriving
    together at limit - 1 cannot both pass: SQLite serializes the writers.
    `None` means the album was already full."""
    return fetch_one(
        connection,
        f"""
        INSERT INTO photos (album_id, storage_key, content_type, size_bytes)
        SELECT :album_id, :storage_key, :content_type, :size_bytes
        WHERE (SELECT COUNT(*) FROM photos WHERE album_id = :album_id) < :limit
        RETURNING {_PHOTO_COLUMNS}
        """,
        PhotoRecord,
        {
            "album_id": album_id,
            "storage_key": storage_key,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "limit": limit,
        },
    )


def list_photos(connection: Connection, album_id: int) -> list[PhotoRecord]:
    # Upload order is the id order.
    return fetch_all(
        connection,
        f"SELECT {_PHOTO_COLUMNS} FROM photos WHERE album_id = :album_id ORDER BY id",
        PhotoRecord,
        {"album_id": album_id},
    )


def delete_photo(
    connection: Connection, album_id: int, photo_id: int, owner_id: int
) -> str | None:
    """Scoped by the photo, the album it must be in and the album's owner.
    Returns the storage key to remove from disk, or `None` when no photo
    matches all three."""
    row = fetch_one(
        connection,
        """
        DELETE FROM photos
        WHERE id = :photo_id
          AND album_id = :album_id
          AND album_id IN (SELECT id FROM albums WHERE owner_id = :owner_id)
        RETURNING storage_key
        """,
        PhotoKeyRecord,
        {"photo_id": photo_id, "album_id": album_id, "owner_id": owner_id},
    )
    return row.storage_key if row is not None else None
