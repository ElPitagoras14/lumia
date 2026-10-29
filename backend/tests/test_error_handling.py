"""The api-conventions scenarios, checked against routes mounted only here.

Each route raises one failure, so the handlers are exercised through the
same app machinery real endpoints go through.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from loguru import logger
from pydantic import BaseModel

from src.exceptions import (
    ForbiddenError,
    NotFoundError,
    QueryExecutionError,
    StateConflictError,
    UnauthenticatedError,
    ValidationFailedError,
)
from src.handlers import register_exception_handlers
from src.main import app as real_app
from src.models import ApiModel
from src.packages.auth.exceptions import InvalidCredentialsError
from src.responses import Envelope


class Thing(ApiModel):
    created_at: str


class Login(BaseModel):
    email: str
    password: str


def _app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/thing")
    def thing() -> Envelope[Thing]:
        return Envelope(data=Thing(created_at="2026-10-28"))

    @app.get("/unauthenticated")
    def unauthenticated():
        raise UnauthenticatedError()

    @app.get("/invalid-credentials")
    def invalid_credentials():
        raise InvalidCredentialsError()

    @app.get("/forbidden")
    def forbidden():
        raise ForbiddenError()

    @app.get("/exists-without-access")
    def exists_without_access():
        raise NotFoundError()

    @app.get("/does-not-exist")
    def does_not_exist():
        raise NotFoundError()

    @app.get("/invalid-field")
    def invalid_field():
        raise ValidationFailedError("title", "must not be blank")

    @app.post("/login")
    def login(body: Login) -> dict:
        return {}

    @app.get("/conflict")
    def conflict():
        raise StateConflictError(
            "album_full", "the album is full", details={"limit": 50}
        )

    @app.get("/boom")
    def boom():
        raise RuntimeError("secret detail: SELECT * FROM users")

    @app.get("/query-failed")
    def query_failed():
        raise QueryExecutionError(
            "SELECT password_hash FROM users failed in /srv/app/db.py"
        )

    return app


@pytest.fixture
def client() -> TestClient:
    # Without this the test client re-raises the unforeseen failure instead
    # of returning the response the handler built.
    return TestClient(_app(), raise_server_exceptions=False)


def test_success_and_error_share_the_same_outer_structure(client):
    ok = client.get("/thing").json()
    failed = client.get("/forbidden").json()

    assert set(ok) == set(failed) == {"data", "error"}
    assert ok["error"] is None
    assert failed["data"] is None


def test_the_real_apps_health_and_an_error_share_the_structure():
    real = TestClient(real_app)

    assert set(real.get("/api/health").json()) == set(real.get("/api/nope").json())


def test_an_unknown_route_is_a_404_in_the_common_structure():
    response = TestClient(real_app).get("/api/does-not-exist")

    assert response.status_code == 404
    assert response.json()["data"] is None
    assert response.json()["error"]["code"] == "http_error"


def test_every_error_carries_a_code_and_a_message(client):
    for path in ("/unauthenticated", "/forbidden", "/does-not-exist", "/conflict"):
        error = client.get(path).json()["error"]
        assert error["code"]
        assert error["message"]


def test_a_compound_field_is_named_in_camel_case(client):
    data = client.get("/thing").json()["data"]

    assert data == {"createdAt": "2026-10-28"}


def test_no_session_is_401_unauthenticated(client):
    response = client.get("/unauthenticated")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_wrong_credentials_are_401_invalid_credentials(client):
    response = client.get("/invalid-credentials")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


def test_no_permission_is_403_and_differs_from_no_session(client):
    forbidden = client.get("/forbidden")

    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "forbidden"
    assert forbidden.json() != client.get("/unauthenticated").json()


def test_existing_without_access_and_missing_are_indistinguishable(client):
    hidden = client.get("/exists-without-access")
    missing = client.get("/does-not-exist")

    assert hidden.status_code == missing.status_code == 404
    assert hidden.json() == missing.json()


def test_a_validation_failure_names_the_field_and_what_was_expected(client):
    response = client.post("/login", json={"email": "ana@example.com"})

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_failed"
    assert error["field"] == "password"
    assert error["message"]


def test_a_failure_the_schema_cannot_express_names_its_field_too(client):
    response = client.get("/invalid-field")

    assert response.status_code == 422
    assert response.json()["error"]["field"] == "title"
    assert response.json()["error"]["message"] == "must not be blank"


def test_a_state_conflict_is_409_without_an_invalid_field(client):
    response = client.get("/conflict")

    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "album_full"
    assert error["field"] is None
    assert error["details"] == {"limit": 50}


def test_an_unforeseen_failure_is_generic_and_its_id_is_in_the_log(client):
    lines: list[str] = []
    sink = logger.add(lines.append, format="{message}\n{exception}")
    try:
        response = client.get("/boom")
    finally:
        logger.remove(sink)

    assert response.status_code == 500
    error = response.json()["error"]
    assert error["code"] == "internal_error"
    request_id = error["requestId"]
    assert request_id
    logged = "".join(lines)
    assert request_id in logged
    assert "RuntimeError" in logged


@pytest.mark.parametrize("path", ["/boom", "/query-failed"])
def test_an_error_response_leaves_out_the_interior_of_the_system(client, path):
    body = client.get(path).text

    for trace in ("Traceback", "SELECT", "users", "password_hash", "/srv/app", ".py"):
        assert trace not in body


def test_a_failed_query_is_503_service_unavailable(client):
    response = client.get("/query-failed")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"
