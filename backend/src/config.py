from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Required on purpose: a missing value must stop startup instead of
    # silently creating the database somewhere unexpected.
    data_dir: Path

    @property
    def database_path(self) -> Path:
        return self.data_dir / "lumia.db"


settings = Settings()
