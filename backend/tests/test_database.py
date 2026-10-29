import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from src.database import engine


@pytest.fixture
def parent_child_tables():
    # Throwaway tables: the schema has no domain tables yet.
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE parent (id INTEGER PRIMARY KEY)"))
        conn.execute(
            text(
                "CREATE TABLE child (id INTEGER PRIMARY KEY, "
                "parent_id INTEGER NOT NULL REFERENCES parent(id))"
            )
        )
    yield
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE child"))
        conn.execute(text("DROP TABLE parent"))


def test_journal_mode_is_wal():
    with engine.connect() as conn:
        assert conn.execute(text("PRAGMA journal_mode")).scalar() == "wal"


@pytest.mark.usefixtures("parent_child_tables")
def test_foreign_key_violation_is_rejected():
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(text("INSERT INTO child (id, parent_id) VALUES (1, 999)"))


@pytest.mark.usefixtures("parent_child_tables")
def test_read_completes_while_a_write_is_open():
    with engine.connect() as writer, engine.connect() as reader:
        writer.begin()
        writer.execute(text("INSERT INTO parent (id) VALUES (1)"))

        # Under WAL the reader sees the last committed state without waiting.
        count = reader.execute(text("SELECT COUNT(*) FROM parent")).scalar()

        assert count == 0
        writer.rollback()
