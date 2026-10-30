from src.images import variant_url
from src.models import ApiModel
from src.packages.results.schemas import ParticipantVoteRecord
from src.packages.results.service import AlbumResults


class ResultsSummary(ApiModel):
    participant_count: int
    vote_count: int
    possible_votes: int


class PhotoResultResponse(ApiModel):
    id: int
    thumb_url: str
    # For the most liked photo shown large and for opening any photo.
    deck_url: str
    approved_count: int
    rejected_count: int
    pending_count: int


class ParticipantResultResponse(ApiModel):
    id: int
    name: str
    rated_count: int
    approved_count: int
    rejected_count: int


class AlbumResultsResponse(ApiModel):
    summary: ResultsSummary
    photos: list[PhotoResultResponse]
    participants: list[ParticipantResultResponse]

    @classmethod
    def from_result(cls, results: AlbumResults) -> "AlbumResultsResponse":
        return cls(
            summary=ResultsSummary(
                participant_count=results.participant_count,
                vote_count=results.vote_count,
                possible_votes=results.possible_votes,
            ),
            photos=[
                PhotoResultResponse(
                    id=item.photo.id,
                    thumb_url=variant_url(item.photo.storage_key, "thumb"),
                    deck_url=variant_url(item.photo.storage_key, "deck"),
                    approved_count=item.photo.approved_count,
                    rejected_count=item.photo.rejected_count,
                    pending_count=item.pending_count,
                )
                for item in results.photos
            ],
            participants=[
                ParticipantResultResponse(
                    id=item.participant.id,
                    name=item.participant.name,
                    rated_count=item.rated_count,
                    approved_count=item.participant.approved_count,
                    rejected_count=item.participant.rejected_count,
                )
                for item in results.participants
            ],
        )


class ParticipantVoteResponse(ApiModel):
    """`approved` is `None` while the participant has not voted the photo."""

    id: int
    thumb_url: str
    approved: bool | None

    @classmethod
    def from_record(cls, vote: ParticipantVoteRecord) -> "ParticipantVoteResponse":
        return cls(
            id=vote.id,
            thumb_url=variant_url(vote.storage_key, "thumb"),
            approved=vote.approved,
        )
