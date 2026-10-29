import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from src.database import client as database_client
from src.main import app
from src.packages.auth.config import SESSION_COOKIE_NAME
from tests.migrate import run_dbmate
from tests.packages.auth.conftest import PASSWORD, session_cookie


def _login(
    client: TestClient, email: str = "ana@example.com", password: str = PASSWORD
):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def _secret(response) -> str:
    return session_cookie(response)[SESSION_COOKIE_NAME].value


def _with_cookie(secret: str) -> dict[str, str]:
    return {"Cookie": f"{SESSION_COOKIE_NAME}={secret}"}


# --- login ---


def test_login_returns_the_user_and_a_session_cookie(client, make_user):
    user = make_user()

    response = _login(client)

    assert response.status_code == 200
    assert response.json() == {
        "data": {"id": user.id, "email": "ana@example.com"},
        "error": None,
    }


def test_the_session_cookie_is_http_only_lax_and_scoped_to_the_api(client, make_user):
    make_user()

    morsel = session_cookie(_login(client))[SESSION_COOKIE_NAME]

    assert morsel["httponly"] is True
    assert morsel["samesite"].lower() == "lax"
    assert morsel["path"] == "/api"
    assert morsel["max-age"] == str(30 * 24 * 3600)
    assert not morsel["secure"]


def test_login_ignores_the_case_of_the_email(client, make_user):
    make_user()

    assert _login(client, email="ANA@Example.com").status_code == 200


def test_a_wrong_password_is_401_and_sets_no_cookie(client, make_user):
    make_user()

    response = _login(client, password="wrong-password")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"
    assert "set-cookie" not in response.headers


def test_an_unknown_email_answers_exactly_like_a_wrong_password(client, make_user):
    make_user()

    unknown = _login(client, email="nobody@example.com")
    wrong = _login(client, password="wrong-password")

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


def test_a_form_body_is_rejected_and_opens_no_session(client, make_user):
    make_user()

    response = client.post(
        "/api/auth/login", data={"email": "ana@example.com", "password": PASSWORD}
    )

    assert response.status_code == 422
    assert "set-cookie" not in response.headers


def test_a_missing_field_is_a_validation_error_naming_it(client):
    response = client.post("/api/auth/login", json={"email": "ana@example.com"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
    assert response.json()["error"]["field"] == "password"


# --- sessions ---


def test_the_cookie_value_is_not_stored(client, conn, make_user):
    make_user()

    secret = _secret(_login(client))

    stored = conn.execute(text("SELECT token_hash FROM sessions")).scalars().all()
    assert secret not in stored


def test_two_logins_are_two_independent_sessions(client, make_user):
    make_user()
    phone = _secret(_login(client))
    laptop = _secret(_login(client))

    client.cookies.clear()
    client.post("/api/auth/logout", headers=_with_cookie(phone))

    assert client.get("/api/auth/me", headers=_with_cookie(phone)).status_code == 401
    assert client.get("/api/auth/me", headers=_with_cookie(laptop)).status_code == 200


def test_an_expired_session_is_unauthenticated(client, conn, make_user):
    make_user()
    secret = _secret(_login(client))
    conn.execute(text("UPDATE sessions SET expires_at = datetime('now', '-1 minute')"))
    client.cookies.clear()

    response = client.get("/api/auth/me", headers=_with_cookie(secret))

    assert response.status_code == 401


# --- owner routes ---


def test_me_returns_the_current_user(client, make_user):
    make_user()
    _login(client)

    response = client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json()["data"]["email"] == "ana@example.com"


def test_me_without_a_cookie_is_401(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_me_with_a_tampered_secret_is_401(client, make_user):
    make_user()
    secret = _secret(_login(client))
    client.cookies.clear()

    response = client.get("/api/auth/me", headers=_with_cookie(secret + "x"))

    assert response.status_code == 401


def test_each_user_sees_their_own_email(client, make_user):
    make_user("ana@example.com")
    make_user("luis@example.com")
    ana = _secret(_login(client, "ana@example.com"))
    luis = _secret(_login(client, "luis@example.com"))
    client.cookies.clear()

    emails = [
        client.get("/api/auth/me", headers=_with_cookie(secret)).json()["data"]["email"]
        for secret in (ana, luis)
    ]

    assert emails == ["ana@example.com", "luis@example.com"]


# --- logout ---


def test_after_logout_the_same_cookie_is_401(client, make_user):
    make_user()
    secret = _secret(_login(client))
    client.cookies.clear()

    logout = client.post("/api/auth/logout", headers=_with_cookie(secret))

    assert logout.status_code == 200
    assert logout.json() == {"data": None, "error": None}
    assert session_cookie(logout)[SESSION_COOKIE_NAME]["max-age"] == "0"
    assert client.get("/api/auth/me", headers=_with_cookie(secret)).status_code == 401


def test_logout_without_a_session_still_succeeds(client):
    assert client.post("/api/auth/logout").status_code == 200


# --- startup ---


@pytest.fixture
def migrated_empty_database(tmp_path, monkeypatch):
    from sqlalchemy import create_engine

    run_dbmate(tmp_path)
    engine = create_engine(f"sqlite:///{tmp_path / 'lumia.db'}")
    monkeypatch.setattr(database_client, "engine", engine)
    yield
    engine.dispose()


@pytest.mark.usefixtures("migrated_empty_database")
def test_the_first_start_seeds_an_owner_who_can_sign_in():
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={"email": "owner@example.com", "password": "seed-password"},
        )

    assert response.status_code == 200
    assert response.json()["data"]["email"] == "owner@example.com"


@pytest.mark.usefixtures("migrated_empty_database")
def test_a_second_start_does_not_create_another_owner():
    with TestClient(app):
        pass
    with TestClient(app):
        pass

    with database_client.engine.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM users")).scalar_one() == 1
