import pytest
from pydantic import BaseModel, ValidationError
from sqlalchemy import create_engine, text

from src.database.client import (
    engine,
    fetch_all,
    fetch_one,
    fetch_val,
    fetch_val_or_none,
    write,
)
from src.database.utils import transaction
from src.exceptions import DatabaseUnavailableError, QueryExecutionError


class Item(BaseModel):
    id: int
    name: str


@pytest.fixture
def items():
    # Throwaway table: committed rows would otherwise leak into other tests.
    with engine.begin() as conn:
        conn.execute(
            text("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
        )
        conn.execute(text("INSERT INTO items (id, name) VALUES (1, 'a'), (2, 'b')"))
    yield
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE items"))


def _count() -> int:
    with engine.connect() as conn:
        return conn.execute(text("SELECT COUNT(*) FROM items")).scalar_one()


@pytest.mark.usefixtures("items")
def test_fetch_one_validates_the_row_against_the_model():
    with engine.connect() as conn:
        item = fetch_one(
            conn, "SELECT id, name FROM items WHERE id = :id", Item, {"id": 2}
        )

    assert item == Item(id=2, name="b")


@pytest.mark.usefixtures("items")
def test_fetch_one_is_none_when_no_row_matches():
    with engine.connect() as conn:
        assert fetch_one(conn, "SELECT id, name FROM items WHERE id = 99", Item) is None


@pytest.mark.usefixtures("items")
def test_fetch_one_fails_when_the_query_stops_returning_a_declared_field():
    with engine.connect() as conn, pytest.raises(ValidationError):
        fetch_one(conn, "SELECT id FROM items WHERE id = 1", Item)


@pytest.mark.usefixtures("items")
def test_fetch_all_returns_every_row_as_a_model():
    with engine.connect() as conn:
        rows = fetch_all(conn, "SELECT id, name FROM items ORDER BY id", Item)

    assert rows == [Item(id=1, name="a"), Item(id=2, name="b")]


@pytest.mark.usefixtures("items")
def test_fetch_val_returns_the_single_value():
    with engine.connect() as conn:
        assert fetch_val(conn, "SELECT COUNT(*) FROM items") == 2


@pytest.mark.usefixtures("items")
def test_fetch_val_or_none_is_none_when_nothing_matches():
    with engine.connect() as conn:
        assert fetch_val_or_none(conn, "SELECT name FROM items WHERE id = 99") is None
        assert fetch_val_or_none(conn, "SELECT name FROM items WHERE id = 1") == "a"


@pytest.mark.usefixtures("items")
def test_a_failed_statement_leaves_as_query_execution_error():
    with engine.connect() as conn:
        with pytest.raises(QueryExecutionError):
            write(conn, "INSERT INTO items (id, name) VALUES (3, NULL)")
        with pytest.raises(QueryExecutionError):
            fetch_val(conn, "SELECT * FROM no_such_table")


@pytest.mark.usefixtures("items")
def test_transaction_commits_on_a_clean_exit():
    with transaction() as conn:
        write(conn, "INSERT INTO items (id, name) VALUES (3, 'c')")

    assert _count() == 3


@pytest.mark.usefixtures("items")
def test_transaction_rolls_back_on_an_exception():
    with pytest.raises(RuntimeError), transaction() as conn:
        write(conn, "INSERT INTO items (id, name) VALUES (3, 'c')")
        raise RuntimeError("boom")

    assert _count() == 2


def test_transaction_on_an_unreachable_database_is_database_unavailable(tmp_path):
    unreachable = create_engine(f"sqlite:///{tmp_path / 'missing' / 'lumia.db'}")

    with pytest.raises(DatabaseUnavailableError), transaction(unreachable):
        pass
