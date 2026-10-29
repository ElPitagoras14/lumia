from src.models import ApiModel
from src.packages.sharing.schemas import ParticipantRecord, SharedAlbumRecord


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
