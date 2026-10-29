import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

from src.database.dependencies import get_connection
from src.handlers import register_exception_handlers
from src.packages.auth import service
from src.packages.auth.config import SESSION_COOKIE_NAME
from src.packages.auth.dependencies import current_user
from src.packages.auth.schemas import UserRecord
from tests.packages.auth.conftest import PASSWORD


@pytest.fixture
def probe(conn):
    """A route that needs `current_user`, and nothing else."""
    app = FastAPI()
    register_exception_handlers(app)
    app.dependency_overrides[get_connection] = lambda: conn

    @app.get("/whoami")
    def whoami(user: UserRecord = Depends(current_user)) -> dict:
        return {"email": user.email}

    return TestClient(app)


def _cookie(secret: str) -> dict[str, str]:
    return {"Cookie": f"{SESSION_COOKIE_NAME}={secret}"}


def test_a_valid_session_gives_the_route_its_user(probe, conn, make_user):
    make_user()
    _, secret = service.login(conn, "ana@example.com", PASSWORD)

    response = probe.get("/whoami", headers=_cookie(secret))

    assert response.status_code == 200
    assert response.json() == {"email": "ana@example.com"}


def test_without_a_cookie_the_route_never_runs(probe):
    response = probe.get("/whoami")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_a_cookie_with_an_unknown_secret_is_unauthenticated(probe):
    response = probe.get("/whoami", headers=_cookie("not-a-session"))

    assert response.status_code == 401


def test_an_expired_session_is_unauthenticated(probe, conn, make_user):
    make_user()
    _, secret = service.login(conn, "ana@example.com", PASSWORD)
    conn.execute(text("UPDATE sessions SET expires_at = datetime('now', '-1 minute')"))

    response = probe.get("/whoami", headers=_cookie(secret))

    assert response.status_code == 401


def test_each_user_gets_their_own_identity(probe, conn, make_user):
    make_user("ana@example.com")
    make_user("luis@example.com")
    _, ana = service.login(conn, "ana@example.com", PASSWORD)
    _, luis = service.login(conn, "luis@example.com", PASSWORD)

    assert probe.get("/whoami", headers=_cookie(ana)).json() == {
        "email": "ana@example.com"
    }
    assert probe.get("/whoami", headers=_cookie(luis)).json() == {
        "email": "luis@example.com"
    }
