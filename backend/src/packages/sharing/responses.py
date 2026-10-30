from src.images import variant_url
from src.models import ApiModel
from src.packages.photos.responses import PhotoUrls
from src.packages.sharing.schemas import (
    GuestPhotoRecord,
    ParticipantRecord,
    SharedAlbumRecord,
)


class ParticipantResponse(ApiModel):
    name: str

    @classmethod
    def from_record(cls, participant: ParticipantRecord) -> "ParticipantResponse":
        return cls(name=participant.name)


class SharedAlbumSummary(ApiModel):
    title: str
    photo_count: int


class SharedAlbumResponse(ApiModel):
    """Only what a guest needs: no album id and nothing about the owner."""

    album: SharedAlbumSummary
    participant: ParticipantResponse | None

    @classmethod
    def from_records(
        cls, album: SharedAlbumRecord, participant: ParticipantRecord | None
    ) -> "SharedAlbumResponse":
        return cls(
            album=SharedAlbumSummary(title=album.title, photo_count=album.photo_count),
            participant=(
                ParticipantResponse.from_record(participant) if participant else None
            ),
        )


class GuestPhotoResponse(ApiModel):
    """Less than the owner's `PhotoResponse` on purpose: no size and no
    timestamps. `approved` is `None` while the photo is pending."""

    id: int
    urls: PhotoUrls
    approved: bool | None

    @classmethod
    def from_record(cls, photo: GuestPhotoRecord) -> "GuestPhotoResponse":
        return cls(
            id=photo.id,
            urls=PhotoUrls(
                thumb=variant_url(photo.storage_key, "thumb"),
                deck=variant_url(photo.storage_key, "deck"),
                viewer=variant_url(photo.storage_key, "viewer"),
            ),
            approved=photo.approved,
        )
