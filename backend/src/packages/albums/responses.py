from src.images import variant_url
from src.models import ApiModel
from src.packages.albums.schemas import AlbumRecord


class AlbumResponse(ApiModel):
    id: int
    title: str
    created_at: str
    photo_count: int
    cover_url: str | None
    share_token: str | None
    participant_count: int

    @classmethod
    def from_record(cls, album: AlbumRecord) -> "AlbumResponse":
        return cls(
            id=album.id,
            title=album.title,
            created_at=album.created_at,
            photo_count=album.photo_count,
            cover_url=(
                variant_url(album.cover_key, "thumb") if album.cover_key else None
            ),
            share_token=album.share_token,
            participant_count=album.participant_count,
        )
