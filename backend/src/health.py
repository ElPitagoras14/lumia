from fastapi import APIRouter

from src.database.client import fetch_val
from src.database.dependencies import DbConnection
from src.models import ApiModel
from src.responses import Envelope

router = APIRouter()


class HealthData(ApiModel):
    status: str


@router.get("/health")
def get_health(connection: DbConnection) -> Envelope[HealthData]:
    """Confirms the backend process is up and can query the database.

    A database that cannot be reached or queried isn't caught here: the
    error propagates to the registered handler (src/handlers.py), which
    answers 503 without revealing any database detail.
    """
    fetch_val(connection, "SELECT 1")
    return Envelope(data=HealthData(status="ok"))
