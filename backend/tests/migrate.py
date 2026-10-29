"""Runs the repository's dbmate migrations, the same artifact production uses."""

import subprocess
from pathlib import Path

# Must match dbmate/Dockerfile and README.md (`grep -rn "amacneil/dbmate"`).
DBMATE_IMAGE = "ghcr.io/amacneil/dbmate:2.35.1"
MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "dbmate"


def run_dbmate(data_dir: Path, *args: str) -> subprocess.CompletedProcess[str]:
    """Apply the repository's migrations to `data_dir/lumia.db`."""
    result = subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{MIGRATIONS_DIR}:/db:ro",
            "-v",
            f"{data_dir}:/data",
            "-e",
            "DATABASE_URL=sqlite:/data/lumia.db",
            DBMATE_IMAGE,
            "--no-dump-schema",
            *(args or ("up",)),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"dbmate failed (exit {result.returncode}):\n"
            f"{result.stdout}\n{result.stderr}"
        )
    return result
