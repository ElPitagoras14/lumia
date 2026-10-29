from sqlalchemy import Connection

from src.exceptions import NotFoundError
from src.packages.albums import repository
from src.packages.albums.schemas import AlbumRecord


def create_album(connection: Connection, owner_id: int, title: str) -> AlbumRecord:
    return repository.insert_album(connection, owner_id, title)


def list_albums(connection: Connection, owner_id: int) -> list[AlbumRecord]:
    return repository.list_albums(connection, owner_id)


def get_album(connection: Connection, owner_id: int, album_id: int) -> AlbumRecord:
    """An album of another owner is a `NotFoundError`, exactly like one that
    does not exist: a 404 for both, so its existence is not revealed."""
    album = repository.get_album(connection, album_id, owner_id)
    if album is None:
        raise NotFoundError()
    return album


def delete_album(connection: Connection, owner_id: int, album_id: int) -> list[str]:
    """Returns the storage keys of the album's photos. The originals are not
    touched here: the caller removes them once the transaction has committed,
    so a failed commit never leaves rows pointing at deleted files."""
    get_album(connection, owner_id, album_id)
    storage_keys = repository.list_storage_keys(connection, album_id)
    repository.delete_album(connection, album_id, owner_id)
    return storage_keys
