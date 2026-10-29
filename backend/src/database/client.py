from pydantic import BaseModel
from sqlalchemy import Connection, create_engine, event, text
from sqlalchemy.exc import SQLAlchemyError

from src.config import settings
from src.exceptions import QueryExecutionError

engine = create_engine(f"sqlite:///{settings.database_path}")


@event.listens_for(engine, "connect")
def _configure_sqlite(dbapi_connection, _connection_record) -> None:
    # SQLite does not persist foreign_keys or busy_timeout, so every
    # connection sets them. journal_mode=WAL does persist and is idempotent;
    # it lives here rather than in a migration because dbmate wraps each
    # migration in a transaction, and WAL cannot be enabled inside one.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


# --- The functions every access to the database goes through. ---
# Each receives the connection it runs on, so the caller controls the
# transaction's scope by choosing which one to pass in. SQL always arrives
# as text with named parameters; values are never concatenated into it. A
# driver failure leaves as QueryExecutionError, so nothing above this layer
# sees the driver's own exception.


def write(connection: Connection, query: str, params: dict | None = None) -> None:
    """Runs a single statement that writes and returns no rows."""
    try:
        connection.execute(text(query), params or {})
    except SQLAlchemyError as exc:
        raise QueryExecutionError("failed to execute a write") from exc


def fetch_one[T: BaseModel](
    connection: Connection,
    query: str,
    model: type[T],
    params: dict | None = None,
) -> T | None:
    """Reads at most one row, validated against `model`, so a query that
    stops returning a declared field fails here and not downstream."""
    try:
        row = connection.execute(text(query), params or {}).mappings().one_or_none()
    except SQLAlchemyError as exc:
        raise QueryExecutionError("failed to execute a read") from exc
    return model.model_validate(dict(row)) if row is not None else None


def fetch_all[T: BaseModel](
    connection: Connection,
    query: str,
    model: type[T],
    params: dict | None = None,
) -> list[T]:
    """Reads every matching row, each validated against `model`."""
    try:
        rows = connection.execute(text(query), params or {}).mappings().all()
    except SQLAlchemyError as exc:
        raise QueryExecutionError("failed to execute a read") from exc
    return [model.model_validate(dict(row)) for row in rows]


def fetch_val(connection: Connection, query: str, params: dict | None = None):
    """For a query that always produces exactly one row -- a count, an
    aggregate, a check. One that can match nothing wants `fetch_val_or_none`."""
    try:
        return connection.execute(text(query), params or {}).scalar_one()
    except SQLAlchemyError as exc:
        raise QueryExecutionError("failed to execute a read") from exc


def fetch_val_or_none(connection: Connection, query: str, params: dict | None = None):
    """For a query that may match no row -- a lookup that can miss, a
    `delete ... returning` that found nothing. `None` instead of raising."""
    try:
        return connection.execute(text(query), params or {}).scalar_one_or_none()
    except SQLAlchemyError as exc:
        raise QueryExecutionError("failed to execute a read") from exc
