from collections.abc import Iterator
from http.cookies import SimpleCookie

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Connection

# Hashing is deliberately slow, so the hash is computed once for every user
# the tests create instead of once per user.
PASSWORD = "correct-password"


@pytest.fixture(scope="session")
def password_hash() -> str:
    from src.packages.auth.security import hash_password

    return hash_password(PASSWORD)


@pytest.fixture
def conn() -> Iterator[Connection]:
    """A connection whose writes are rolled back after each test, so tests
    never see each other's users or sessions."""
    # Imported here, not at module level: src.config reads DATA_DIR on
    # import, and when a subdirectory is run on its own this conftest is
    # imported before tests/conftest.py's pytest_configure has set it.
    from src.database.client import engine

    with engine.connect() as connection:
        connection.begin()
        yield connection
        connection.rollback()


@pytest.fixture
def make_user(conn: Connection, password_hash: str):
    from src.packages.auth import repository

    def make(email: str = "ana@example.com"):
        return repository.insert_user(conn, email, password_hash)

    return make


@pytest.fixture
def client(conn: Connection) -> Iterator[TestClient]:
    """The real app, with every request running on the test's own
    connection: nothing it writes is committed, and the test sees it all."""
    from src.database.dependencies import get_connection
    from src.main import app

    app.dependency_overrides[get_connection] = lambda: conn
    yield TestClient(app)
    app.dependency_overrides.clear()


def session_cookie(response) -> SimpleCookie:
    """The Set-Cookie of a response, parsed, with its attributes."""
    cookie: SimpleCookie = SimpleCookie()
    cookie.load(response.headers["set-cookie"])
    return cookie
