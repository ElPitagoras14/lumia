from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Connection, Engine
from sqlalchemy.exc import SQLAlchemyError

from src.database import client as _client_module
from src.exceptions import DatabaseUnavailableError


@contextmanager
def transaction(engine: Engine | None = None) -> Iterator[Connection]:
    """Commits on a clean exit, rolls back on an exception, so the unit of
    work's boundary is this `with` block and not the call stack.

    `engine` is looked up on the module rather than imported by value, so a
    test session can repoint the default at another database without every
    caller passing one."""
    try:
        connection = (engine or _client_module.engine).connect()
    except SQLAlchemyError as exc:
        raise DatabaseUnavailableError("could not reach the database") from exc
    with connection, connection.begin():
        yield connection
