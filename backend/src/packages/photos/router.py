from collections.abc import Iterator
from typing import Annotated, BinaryIO

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile

from src.database.dependencies import DbConnection
from src.packages.auth.dependencies import current_user
from src.packages.auth.schemas import UserRecord
from src.packages.photos import service, storage
from src.packages.photos.responses import PhotoResponse
from src.responses import Envelope

router = APIRouter(prefix="/albums/{album_id}/photos")

Owner = Annotated[UserRecord, Depends(current_user)]


def _read_chunks(file: BinaryIO) -> Iterator[bytes]:
    while chunk := file.read(storage.CHUNK_SIZE):
        yield chunk


@router.get("")
def list_photos(
    album_id: int, owner: Owner, connection: DbConnection
) -> Envelope[list[PhotoResponse]]:
    photos = service.list_photos(connection, owner.id, album_id)
    return Envelope(data=[PhotoResponse.from_record(photo) for photo in photos])


@router.post("", status_code=201)
def upload_photo(
    album_id: int,
    file: UploadFile,
    owner: Owner,
    connection: DbConnection,
    background_tasks: BackgroundTasks,
) -> Envelope[PhotoResponse]:
    # One file per request: every outcome is a plain status code. The
    # client's file name and declared type are ignored on purpose.
    photo = service.upload_photo(
        connection, owner.id, album_id, _read_chunks(file.file)
    )
    background_tasks.add_task(service.warm_thumbnail, photo.storage_key)
    return Envelope(data=PhotoResponse.from_record(photo))


@router.delete("/{photo_id}")
def delete_photo(
    album_id: int,
    photo_id: int,
    owner: Owner,
    connection: DbConnection,
    background_tasks: BackgroundTasks,
) -> Envelope[None]:
    storage_key = service.delete_photo(connection, owner.id, album_id, photo_id)
    # After the response, hence after the commit.
    background_tasks.add_task(storage.delete_original, storage_key)
    return Envelope(data=None)
