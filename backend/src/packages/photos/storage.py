"""The originals on disk. Everything that touches /data/photos lives here, so
the rest of the package only deals in storage keys.
"""

import uuid
from collections.abc import Iterator
from pathlib import Path

from loguru import logger

from src.config import settings
from src.exceptions import ValidationFailedError
from src.packages.photos.config import MAX_PHOTO_BYTES

CHUNK_SIZE = 64 * 1024

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def photos_dir() -> Path:
    return settings.data_dir / "photos"


def detect_content_type(head: bytes) -> str | None:
    """Decided from the file's first bytes, never from the declared type or
    the extension. It proves the signature, not that the file decodes;
    imgproxy fails safely on a corrupt one."""
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(_PNG_SIGNATURE):
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


def save_upload(chunks: Iterator[bytes]) -> tuple[str, str, int]:
    """Writes an upload to `<uuid>.part`, checking the signature on the first
    bytes and the size as it goes, then renames it to its final name so a
    half-written file is never visible under a valid key. Returns the storage
    key, the detected content type and the size; on any failure the partial
    file is gone.
    """
    directory = photos_dir()
    directory.mkdir(parents=True, exist_ok=True)
    storage_key = uuid.uuid4().hex
    partial = directory / f"{storage_key}.part"

    content_type: str | None = None
    size = 0
    try:
        with partial.open("wb") as out:
            for chunk in chunks:
                if content_type is None:
                    content_type = detect_content_type(chunk)
                    if content_type is None:
                        raise ValidationFailedError(
                            "file", "must be a JPEG, PNG or WebP image"
                        )
                size += len(chunk)
                if size > MAX_PHOTO_BYTES:
                    raise ValidationFailedError(
                        "file", f"must be at most {MAX_PHOTO_BYTES // 1024 // 1024} MiB"
                    )
                out.write(chunk)
        if content_type is None:
            raise ValidationFailedError("file", "must not be empty")
        partial.rename(directory / storage_key)
    except BaseException:
        partial.unlink(missing_ok=True)
        raise
    return storage_key, content_type, size


def delete_original(storage_key: str) -> None:
    """Best effort: a file that is already gone, or cannot be removed, is
    logged and ignored -- at worst an unreferenced original stays on disk,
    never a row without its file."""
    try:
        (photos_dir() / storage_key).unlink(missing_ok=True)
    except OSError:
        logger.opt(exception=True).warning(
            f"could not delete the original {storage_key}"
        )


def delete_originals(storage_keys: list[str]) -> None:
    for storage_key in storage_keys:
        delete_original(storage_key)
