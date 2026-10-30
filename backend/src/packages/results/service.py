from pydantic import BaseModel
from sqlalchemy import Connection

from src.exceptions import NotFoundError
from src.packages.albums import service as albums_service
from src.packages.results import repository
from src.packages.results.schemas import (
    ParticipantTallyRecord,
    ParticipantVoteRecord,
    PhotoTallyRecord,
)


class PhotoResult(BaseModel):
    photo: PhotoTallyRecord
    pending_count: int


class ParticipantResult(BaseModel):
    participant: ParticipantTallyRecord
    rated_count: int


class AlbumResults(BaseModel):
    participant_count: int
    vote_count: int
    possible_votes: int
    photos: list[PhotoResult]
    participants: list[ParticipantResult]


def get_results(connection: Connection, owner_id: int, album_id: int) -> AlbumResults:
    """An album of another owner is a `NotFoundError`, exactly like one that
    does not exist. A pair (photo, participant) without a vote is pending:
    it counts as neither approved nor rejected."""
    albums_service.get_album(connection, owner_id, album_id)
    photos = repository.list_photo_tallies(connection, album_id)
    participants = repository.list_participant_tallies(connection, album_id)

    photo_results = [
        PhotoResult(
            photo=photo,
            pending_count=len(participants)
            - photo.approved_count
            - photo.rejected_count,
        )
        for photo in photos
    ]
    participant_results = [
        ParticipantResult(
            participant=participant,
            rated_count=participant.approved_count + participant.rejected_count,
        )
        for participant in participants
    ]
    return AlbumResults(
        participant_count=len(participants),
        vote_count=sum(result.rated_count for result in participant_results),
        possible_votes=len(photos) * len(participants),
        photos=photo_results,
        participants=participant_results,
    )


def list_participant_votes(
    connection: Connection, owner_id: int, album_id: int, participant_id: int
) -> list[ParticipantVoteRecord]:
    albums_service.get_album(connection, owner_id, album_id)
    if not repository.participant_exists(connection, album_id, participant_id):
        raise NotFoundError()
    return repository.list_participant_votes(connection, album_id, participant_id)


def delete_participant(
    connection: Connection, owner_id: int, album_id: int, participant_id: int
) -> None:
    albums_service.get_album(connection, owner_id, album_id)
    if not repository.delete_participant(connection, album_id, participant_id):
        raise NotFoundError()
