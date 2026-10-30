from typing import Annotated

from fastapi import APIRouter, Depends

from src.database.dependencies import DbConnection
from src.packages.auth.dependencies import current_user
from src.packages.auth.schemas import UserRecord
from src.packages.results import service
from src.packages.results.responses import (
    AlbumResultsResponse,
    ParticipantVoteResponse,
)
from src.responses import Envelope

router = APIRouter(prefix="/albums/{album_id}")

Owner = Annotated[UserRecord, Depends(current_user)]


@router.get("/results")
def get_album_results(
    album_id: int, owner: Owner, connection: DbConnection
) -> Envelope[AlbumResultsResponse]:
    results = service.get_results(connection, owner.id, album_id)
    return Envelope(data=AlbumResultsResponse.from_result(results))


@router.get("/participants/{participant_id}/ratings")
def list_participant_votes(
    album_id: int, participant_id: int, owner: Owner, connection: DbConnection
) -> Envelope[list[ParticipantVoteResponse]]:
    votes = service.list_participant_votes(
        connection, owner.id, album_id, participant_id
    )
    return Envelope(data=[ParticipantVoteResponse.from_record(v) for v in votes])


# A write, so only an explicit DELETE reaches it.
@router.delete("/participants/{participant_id}")
def delete_participant(
    album_id: int, participant_id: int, owner: Owner, connection: DbConnection
) -> Envelope[None]:
    service.delete_participant(connection, owner.id, album_id, participant_id)
    return Envelope(data=None)
