import urllib.request
from collections.abc import Iterator

from loguru import logger
from sqlalchemy import Connection

from src.exceptions import NotFoundError, StateConflictError
from src.images import variant_url
from src.packages.albums import service as albums_service
from src.packages.photos import repository, storage
from src.packages.photos.config import MAX_PHOTOS_PER_ALBUM, photo_settings
from src.packages.photos.schemas import PhotoRecord

_WARMUP_TIMEOUT_SECONDS = 3


def _album_full() -> StateConflictError:
    return StateConflictError(
        "album_full",
        "the album already has the maximum number of photos",
        details={"limit": MAX_PHOTOS_PER_ALBUM},
    )


def list_photos(
    connection: Connection, owner_id: int, album_id: int
) -> list[PhotoRecord]:
    albums_service.get_album(connection, owner_id, album_id)
    return repository.list_photos(connection, album_id)


def upload_photo(
    connection: Connection, owner_id: int, album_id: int, chunks: Iterator[bytes]
) -> PhotoRecord:
    """Validates, writes the original and registers the photo. The album is
    checked first and the count before writing, so a foreign or a full album
    never costs a file; the insert then re-checks the count atomically, which
    is what actually holds the limit. Whatever fails after the file exists
    removes it, so a failed upload leaves no original without its row."""
    albums_service.get_album(connection, owner_id, album_id)
    if repository.count_photos(connection, album_id) >= MAX_PHOTOS_PER_ALBUM:
        raise _album_full()

    storage_key, content_type, size_bytes = storage.save_upload(chunks)
    try:
        photo = repository.insert_photo(
            connection,
            album_id,
            storage_key,
            content_type,
            size_bytes,
            MAX_PHOTOS_PER_ALBUM,
        )
        if photo is None:
            raise _album_full()
    except BaseException:
        storage.delete_original(storage_key)
        raise
    return photo


def delete_photo(
    connection: Connection, owner_id: int, album_id: int, photo_id: int
) -> str:
    """Returns the storage key; the caller removes the original once the
    transaction has committed."""
    storage_key = repository.delete_photo(connection, album_id, photo_id, owner_id)
    if storage_key is None:
        raise NotFoundError()
    return storage_key


def warm_thumbnail(storage_key: str) -> None:
    """Requests the thumbnail through nginx so it is already cached when the
    owner's grid asks for it. Best effort: any failure is swallowed, since the
    upload it follows has already succeeded."""
    url = photo_settings.image_warmup_base_url + variant_url(storage_key, "thumb")
    try:
        with urllib.request.urlopen(url, timeout=_WARMUP_TIMEOUT_SECONDS) as response:
            response.read()
    except Exception:
        logger.debug(f"could not warm the thumbnail of {storage_key}")
