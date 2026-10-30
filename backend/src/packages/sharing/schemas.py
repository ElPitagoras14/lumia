from typing import Annotated

from pydantic import BaseModel, StrictBool, StringConstraints

from src.models import ApiModel


class SharedAlbumRecord(BaseModel):
    id: int
    title: str
    photo_count: int


class ParticipantRecord(BaseModel):
    id: int
    name: str


class JoinRequest(ApiModel):
    # Trimmed before the length check, so a name of only spaces is empty.
    name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)
    ]


class GuestPhotoRecord(BaseModel):
    id: int
    storage_key: str
    # None while the participant has not voted the photo.
    approved: bool | None


class RateRequest(ApiModel):
    # Strict: the default coercion would accept "true", 1 or "yes" as a vote.
    approved: StrictBool
