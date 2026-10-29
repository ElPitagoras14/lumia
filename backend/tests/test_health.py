from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.database import get_session
from src.main import app

client = TestClient(app)


def test_health_is_ok_when_the_database_answers():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_is_503_when_the_database_cannot_be_queried(tmp_path):
    # A database inside a directory that does not exist cannot be opened.
    unreachable = create_engine(f"sqlite:///{tmp_path / 'missing' / 'lumia.db'}")

    def broken_session():
        with Session(unreachable) as session:
            yield session

    app.dependency_overrides[get_session] = broken_session
    try:
        response = client.get("/api/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
