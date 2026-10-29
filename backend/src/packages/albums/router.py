from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends

from src.database.dependencies import DbConnection
from src.packages.albums import service
from src.packages.albums.responses import AlbumResponse
from src.packages.albums.schemas import CreateAlbumRequest
from src.packages.auth.dependencies import current_user
from src.packages.auth.schemas import UserRecord
from src.packages.photos import storage
from src.responses import Envelope

router = APIRouter(prefix="/albums")

Owner = Annotated[UserRecord, Depends(current_user)]


@router.post("", status_code=201)
def create_album(
    body: CreateAlbumRequest, owner: Owner, connection: DbConnection
) -> Envelope[AlbumResponse]:
    album = service.create_album(connection, owner.id, body.title)
    return Envelope(data=AlbumResponse.from_record(album))


@router.get("")
def list_albums(
    owner: Owner, connection: DbConnection
) -> Envelope[list[AlbumResponse]]:
    albums = service.list_albums(connection, owner.id)
    return Envelope(data=[AlbumResponse.from_record(album) for album in albums])


@router.get("/{album_id}")
def get_album(
    album_id: int, owner: Owner, connection: DbConnection
) -> Envelope[AlbumResponse]:
    album = service.get_album(connection, owner.id, album_id)
    return Envelope(data=AlbumResponse.from_record(album))


@router.delete("/{album_id}")
def delete_album(
    album_id: int,
    owner: Owner,
    connection: DbConnection,
    background_tasks: BackgroundTasks,
) -> Envelope[None]:
    storage_keys = service.delete_album(connection, owner.id, album_id)
    # Background tasks run after the response, which is after the commit.
    background_tasks.add_task(storage.delete_originals, storage_keys)
    return Envelope(data=None)
