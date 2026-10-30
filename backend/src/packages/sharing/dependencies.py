from typing import Annotated, NamedTuple

from fastapi import Depends, Request

from src.database.dependencies import DbConnection
from src.exceptions import UnauthenticatedError
from src.packages.sharing import service
from src.packages.sharing.config import participant_cookie_name
from src.packages.sharing.schemas import ParticipantRecord, SharedAlbumRecord


class Guest(NamedTuple):
    album: SharedAlbumRecord
    participant: ParticipantRecord


def current_participant(
    token: str, request: Request, connection: DbConnection
) -> Guest:
    """The guest's counterpart of `current_user`. The token resolves first, so
    an unknown or revoked one is a 404 with or without a cookie; only then is
    the cookie of that album read, and without a participant behind it the
    request is a 401. The cookie's name depends on the album, hence
    `request.cookies` instead of a declared parameter."""
    album = service.resolve_link(connection, token)
    secret = request.cookies.get(participant_cookie_name(album.id))
    participant = service.identify_participant(connection, album.id, secret)
    if participant is None:
        raise UnauthenticatedError()
    return Guest(album, participant)


CurrentGuest = Annotated[Guest, Depends(current_participant)]
