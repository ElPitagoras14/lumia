from pydantic import BaseModel


class PhotoRecord(BaseModel):
    id: int
    storage_key: str
    size_bytes: int
    created_at: str


class PhotoKeyRecord(BaseModel):
    storage_key: str
