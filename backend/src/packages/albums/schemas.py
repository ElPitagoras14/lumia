"""Internal data shapes and request bodies of the albums package. What
crosses the API boundary in a response is declared in responses.py instead.
"""

from typing import Annotated

from pydantic import BaseModel, StringConstraints

from src.models import ApiModel


class AlbumRecord(BaseModel):
    id: int
    title: str
    created_at: str
    photo_count: int
    # The first photo uploaded, which the list shows as the album's cover.
    cover_key: str | None


class StorageKeyRecord(BaseModel):
    storage_key: str


class CreateAlbumRequest(ApiModel):
    # Trimmed before the length check, so a title of only spaces is empty.
    title: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
