import secrets

from sqlalchemy import Connection

from src.exceptions import NotFoundError
from src.packages.albums import service as albums_service
from src.packages.albums.schemas import AlbumRecord
from src.packages.auth.security import generate_session_secret, hash_session_secret
from src.packages.sharing import repository
from src.packages.sharing.config import SHARE_TOKEN_BYTES
from src.packages.sharing.schemas import ParticipantRecord, SharedAlbumRecord


def generate_share_link(
    connection: Connection, owner_id: int, album_id: int
) -> AlbumRecord:
    """Creates the album's link or replaces the existing one. An album of
    another owner is a `NotFoundError`, exactly like one that does not
    exist."""
    albums_service.get_album(connection, owner_id, album_id)
    repository.upsert_share_token(
        connection, album_id, secrets.token_urlsafe(SHARE_TOKEN_BYTES)
    )
    return albums_service.get_album(connection, owner_id, album_id)


def resolve_link(connection: Connection, token: str) -> SharedAlbumRecord:
    """An unknown token and a revoked one are the same thing: the row is
    gone."""
    album = repository.get_album_by_token(connection, token)
    if album is None:
        raise NotFoundError()
    return album


def identify_participant(
    connection: Connection, album_id: int, secret: str | None
) -> ParticipantRecord | None:
    if secret is None:
        return None
    return repository.get_participant(connection, album_id, hash_session_secret(secret))


def join(
    connection: Connection, album: SharedAlbumRecord, name: str, secret: str | None
) -> tuple[ParticipantRecord, str | None]:
    """Returns the participant and, only when one was created, the secret for
    its cookie. Someone already identified for the album is returned as is:
    a double submit must not leave an orphan participant behind."""
    existing = identify_participant(connection, album.id, secret)
    if existing is not None:
        return existing, None
    new_secret = generate_session_secret()
    participant = repository.insert_participant(
        connection, album.id, name, hash_session_secret(new_secret)
    )
    return participant, new_secret
