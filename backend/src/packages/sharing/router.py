from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from src.database.dependencies import DbConnection
from src.packages.albums.responses import AlbumResponse
from src.packages.auth.dependencies import current_user
from src.packages.auth.schemas import UserRecord
from src.packages.sharing import service
from src.packages.sharing.config import (
    PARTICIPANT_COOKIE_LIFETIME,
    PARTICIPANT_COOKIE_PATH,
    participant_cookie_name,
)
from src.packages.sharing.dependencies import CurrentGuest
from src.packages.sharing.responses import (
    GuestPhotoResponse,
    ParticipantResponse,
    SharedAlbumResponse,
)
from src.packages.sharing.schemas import JoinRequest, RateRequest
from src.responses import Envelope

Owner = Annotated[UserRecord, Depends(current_user)]

# The owner's side: a write, so only an explicit POST reaches it.
owner_router = APIRouter(prefix="/albums/{album_id}/share")

# The guest's side: no session, the token in the path is the credential.
guest_router = APIRouter(prefix="/share/{token}")


@owner_router.post("")
def generate_share_link(
    album_id: int, owner: Owner, connection: DbConnection
) -> Envelope[AlbumResponse]:
    album = service.generate_share_link(connection, owner.id, album_id)
    return Envelope(data=AlbumResponse.from_record(album))


# The cookie's name depends on the album, which is only known once the token
# resolves, so it is read from the request instead of declared as a parameter.
# No `secure`, for the same reason as the owner's session cookie.


@guest_router.get("")
def get_shared_album(
    token: str, request: Request, connection: DbConnection
) -> Envelope[SharedAlbumResponse]:
    album = service.resolve_link(connection, token)
    secret = request.cookies.get(participant_cookie_name(album.id))
    participant = service.identify_participant(connection, album.id, secret)
    return Envelope(data=SharedAlbumResponse.from_records(album, participant))


@guest_router.post("/participants", status_code=201)
def join_shared_album(
    token: str,
    body: JoinRequest,
    request: Request,
    response: Response,
    connection: DbConnection,
) -> Envelope[ParticipantResponse]:
    album = service.resolve_link(connection, token)
    secret = request.cookies.get(participant_cookie_name(album.id))
    participant, new_secret = service.join(connection, album, body.name, secret)
    if new_secret is None:
        # Already identified: nothing was created, so not a 201.
        response.status_code = 200
    else:
        response.set_cookie(
            key=participant_cookie_name(album.id),
            value=new_secret,
            max_age=int(PARTICIPANT_COOKIE_LIFETIME.total_seconds()),
            httponly=True,
            samesite="lax",
            path=PARTICIPANT_COOKIE_PATH,
        )
    return Envelope(data=ParticipantResponse.from_record(participant))


@guest_router.get("/photos")
def list_guest_photos(
    guest: CurrentGuest, connection: DbConnection
) -> Envelope[list[GuestPhotoResponse]]:
    photos = service.list_photos(connection, guest.album.id, guest.participant.id)
    return Envelope(data=[GuestPhotoResponse.from_record(p) for p in photos])


# A write, so only an explicit PUT with a JSON body reaches it.
@guest_router.put("/photos/{photo_id}/rating")
def rate_guest_photo(
    photo_id: int, body: RateRequest, guest: CurrentGuest, connection: DbConnection
) -> Envelope[GuestPhotoResponse]:
    photo = service.rate_photo(
        connection, guest.album.id, guest.participant.id, photo_id, body.approved
    )
    return Envelope(data=GuestPhotoResponse.from_record(photo))
