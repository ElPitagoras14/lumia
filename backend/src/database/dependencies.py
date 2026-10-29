from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Connection

from src.database.utils import transaction


def get_connection() -> Iterator[Connection]:
    """A connection scoped to one request, inside its own transaction: every
    write an endpoint makes commits together when it returns normally, and
    rolls back together if it raises. Tests override this dependency to
    reuse the already-open, rollback-only connection their own fixture
    provides.
    """
    with transaction() as connection:
        yield connection


# `scope="function"` ends the dependency, and so commits, before the response
# is sent. The default ("request") would commit afterwards: the client could
# act on a 200 whose write is not visible yet, and a failed commit could no
# longer turn into an error. Endpoints take this alias, never `Depends` on
# `get_connection` directly, so the scope cannot be forgotten.
DbConnection = Annotated[Connection, Depends(get_connection, scope="function")]
