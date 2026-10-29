import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from src.database import client
from src.main import app

test_client = TestClient(app)


def test_health_is_ok_when_the_database_answers():
    response = test_client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"data": {"status": "ok"}, "error": None}


def test_health_is_503_when_the_database_cannot_be_reached(tmp_path, monkeypatch):
    # A database inside a directory that does not exist cannot be opened.
    unreachable = create_engine(f"sqlite:///{tmp_path / 'missing' / 'lumia.db'}")
    monkeypatch.setattr(client, "engine", unreachable)

    response = test_client.get("/api/health")

    assert response.status_code == 503
    body = response.json()
    assert body["data"] is None
    assert body["error"]["code"] == "service_unavailable"


@pytest.mark.parametrize("leak", ["sqlite", "missing", "unable to open"])
def test_503_does_not_reveal_the_database(tmp_path, monkeypatch, leak):
    unreachable = create_engine(f"sqlite:///{tmp_path / 'missing' / 'lumia.db'}")
    monkeypatch.setattr(client, "engine", unreachable)

    response = test_client.get("/api/health")

    assert leak not in response.text.lower()
