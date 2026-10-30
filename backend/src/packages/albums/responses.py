from src.images import variant_url
from src.models import ApiModel
from src.packages.albums.schemas import AlbumRecord


class AlbumResponse(ApiModel):
    id: int
    title: str
    created_at: str
    photo_count: int
    # Up to three, in upload order. The first is the mosaic's large tile, so
    # it comes in the deck variant; the rest are thumbnails.
    cover_urls: list[str]
    share_token: str | None
    participant_count: int

    @classmethod
    def from_record(cls, album: AlbumRecord) -> "AlbumResponse":
        return cls(
            id=album.id,
            title=album.title,
            created_at=album.created_at,
            photo_count=album.photo_count,
            cover_urls=[
                variant_url(key, "deck" if index == 0 else "thumb")
                for index, key in enumerate(album.cover_keys)
            ],
            share_token=album.share_token,
            participant_count=album.participant_count,
        )
