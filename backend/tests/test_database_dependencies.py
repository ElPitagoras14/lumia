import asyncio
import contextlib

import pytest
from fastapi import FastAPI
from sqlalchemy import text

from src.database.client import engine, write
from src.database.dependencies import DbConnection


@pytest.fixture
def notes():
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE notes (id INTEGER PRIMARY KEY)"))
    yield
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE notes"))


def _visible_notes() -> int:
    with engine.connect() as conn:
        return conn.execute(text("SELECT COUNT(*) FROM notes")).scalar_one()


def _app() -> FastAPI:
    app = FastAPI()

    @app.post("/write")
    def write_note(connection: DbConnection) -> dict:
        write(connection, "INSERT INTO notes (id) VALUES (1)")
        return {}

    @app.post("/fail")
    def write_then_fail(connection: DbConnection) -> dict:
        write(connection, "INSERT INTO notes (id) VALUES (1)")
        raise RuntimeError("boom")

    return app


def _call(app: FastAPI, path: str) -> list[int]:
    """Calls the app without a client that waits for the whole exchange, and
    returns how many notes other connections see at each message the app
    sends -- so what was already committed when the response started can be
    told apart from what was committed afterwards."""
    seen: list[int] = []
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "root_path": "",
        "query_string": b"",
        "headers": [],
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        if message["type"] == "http.response.start":
            seen.append(_visible_notes())

    async def run():
        with contextlib.suppress(RuntimeError):
            await app(scope, receive, send)

    asyncio.run(run())
    return seen


@pytest.mark.usefixtures("notes")
def test_the_write_is_committed_before_the_response_starts():
    # With the default dependency scope the commit would only happen after
    # the response was sent, and this would see 0.
    assert _call(_app(), "/write") == [1]


@pytest.mark.usefixtures("notes")
def test_an_endpoint_that_raises_rolls_its_writes_back():
    _call(_app(), "/fail")

    assert _visible_notes() == 0
