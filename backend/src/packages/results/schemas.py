from pydantic import BaseModel


class PhotoTallyRecord(BaseModel):
    id: int
    storage_key: str
    approved_count: int
    rejected_count: int


class ParticipantTallyRecord(BaseModel):
    id: int
    name: str
    approved_count: int
    rejected_count: int


class ParticipantVoteRecord(BaseModel):
    id: int
    storage_key: str
    # None while the participant has not voted the photo.
    approved: bool | None
