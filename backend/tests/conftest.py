"""Test setup.

The schema is built the same way production builds it: by running dbmate's
image against dbmate/migrations/ (design D6, D11), never by another
mechanism. That makes Docker a requirement for the backend tests.

src.config reads its settings at import time, so DATA_DIR has to point at
the test directory before any test module imports the app. That is why it is
set in pytest_configure, which runs before collection.
"""

import os
import shutil
import tempfile
from pathlib import Path

import pytest

from tests.migrate import run_dbmate

_data_dir: Path | None = None


def pytest_configure(config: pytest.Config) -> None:
    global _data_dir
    _data_dir = Path(tempfile.mkdtemp(prefix="lumia-test-"))
    os.environ["DATA_DIR"] = str(_data_dir)
    # Required settings; only the seeding tests care about their values.
    os.environ["ADMIN_EMAIL"] = "owner@example.com"
    os.environ["ADMIN_PASSWORD"] = "seed-password"
    os.environ["IMAGE_SIGNING_KEY"] = "ab" * 32
    os.environ["IMAGE_SIGNING_SALT"] = "cd" * 32
    run_dbmate(_data_dir)


def pytest_unconfigure(config: pytest.Config) -> None:
    if _data_dir is not None:
        shutil.rmtree(_data_dir, ignore_errors=True)
