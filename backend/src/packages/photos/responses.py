from src.images import variant_url
from src.models import ApiModel
from src.packages.photos.schemas import PhotoRecord


class PhotoUrls(ApiModel):
    thumb: str
    deck: str
    viewer: str


class PhotoResponse(ApiModel):
    """The storage key is deliberately absent: it names the original on disk
    and only ever leaves the backend inside a signed variant URL."""

    id: int
    size_bytes: int
    created_at: str
    urls: PhotoUrls

    @classmethod
    def from_record(cls, photo: PhotoRecord) -> "PhotoResponse":
        return cls(
            id=photo.id,
            size_bytes=photo.size_bytes,
            created_at=photo.created_at,
            urls=PhotoUrls(
                thumb=variant_url(photo.storage_key, "thumb"),
                deck=variant_url(photo.storage_key, "deck"),
                viewer=variant_url(photo.storage_key, "viewer"),
            ),
        )
