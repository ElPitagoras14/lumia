from typing import Annotated

from pydantic import BaseModel, StringConstraints

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
