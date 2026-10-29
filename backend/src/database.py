from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from src.config import settings

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


SessionLocal = sessionmaker(bind=engine)


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
