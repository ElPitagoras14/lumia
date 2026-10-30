from sqlalchemy import Connection

from src.database.client import fetch_all, fetch_val_or_none
from src.packages.results.schemas import (
    ParticipantTallyRecord,
    ParticipantVoteRecord,
    PhotoTallyRecord,
)

# The album's ownership is checked by the service before any of these run.
# Ratings are not filtered by album: the composite foreign keys keep a vote
# in the same album as its photo and its participant.


def list_photo_tallies(connection: Connection, album_id: int) -> list[PhotoTallyRecord]:
    # Upload order is the id order.
    return fetch_all(
        connection,
        "SELECT p.id, p.storage_key, "
        "COALESCE(SUM(r.approved = 1), 0) AS approved_count, "
        "COALESCE(SUM(r.approved = 0), 0) AS rejected_count "
        "FROM photos p LEFT JOIN ratings r ON r.photo_id = p.id "
        "WHERE p.album_id = :album_id GROUP BY p.id ORDER BY p.id",
        PhotoTallyRecord,
        {"album_id": album_id},
    )


def list_participant_tallies(
    connection: Connection, album_id: int
) -> list[ParticipantTallyRecord]:
    # Join order is the id order.
    return fetch_all(
        connection,
        "SELECT pa.id, pa.name, "
        "COALESCE(SUM(r.approved = 1), 0) AS approved_count, "
        "COALESCE(SUM(r.approved = 0), 0) AS rejected_count "
        "FROM participants pa LEFT JOIN ratings r ON r.participant_id = pa.id "
        "WHERE pa.album_id = :album_id GROUP BY pa.id ORDER BY pa.id",
        ParticipantTallyRecord,
        {"album_id": album_id},
    )


def participant_exists(
    connection: Connection, album_id: int, participant_id: int
) -> bool:
    found = fetch_val_or_none(
        connection,
        "SELECT id FROM participants "
        "WHERE id = :participant_id AND album_id = :album_id",
        {"participant_id": participant_id, "album_id": album_id},
    )
    return found is not None


def list_participant_votes(
    connection: Connection, album_id: int, participant_id: int
) -> list[ParticipantVoteRecord]:
    return fetch_all(
        connection,
        "SELECT p.id, p.storage_key, r.approved "
        "FROM photos p LEFT JOIN ratings r "
        "ON r.photo_id = p.id AND r.participant_id = :participant_id "
        "WHERE p.album_id = :album_id ORDER BY p.id",
        ParticipantVoteRecord,
        {"album_id": album_id, "participant_id": participant_id},
    )


def delete_participant(
    connection: Connection, album_id: int, participant_id: int
) -> bool:
    """One statement, so a participant that does not exist, one of another
    album and one already deleted are the same miss. The votes go with it
    through the foreign key's cascade."""
    deleted = fetch_val_or_none(
        connection,
        "DELETE FROM participants "
        "WHERE id = :participant_id AND album_id = :album_id RETURNING id",
        {"participant_id": participant_id, "album_id": album_id},
    )
    return deleted is not None
