import sqlite3
from pathlib import Path

from tests.migrate import run_dbmate


def _applied_versions(db_path: Path) -> list[str]:
    with sqlite3.connect(db_path) as con:
        rows = con.execute("SELECT version FROM schema_migrations ORDER BY version")
        return [row[0] for row in rows]


def test_migrating_a_missing_database_creates_it_at_the_latest_version(tmp_path):
    db_path = tmp_path / "lumia.db"
    assert not db_path.exists()

    run_dbmate(tmp_path)

    assert db_path.exists()
    assert _applied_versions(db_path) == ["0001"]


def test_migrating_an_up_to_date_database_applies_nothing(tmp_path):
    run_dbmate(tmp_path)

    second = run_dbmate(tmp_path)

    assert "Applying" not in second.stdout
    assert _applied_versions(tmp_path / "lumia.db") == ["0001"]
