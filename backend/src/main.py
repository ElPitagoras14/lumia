from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from loguru import logger

from src.database.utils import transaction
from src.handlers import register_exception_handlers
from src.packages.auth import service as auth_service
from src.packages.auth.config import auth_settings
from src.routes import api_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Not caught: a database that cannot be written, or that was never
    # migrated, fails startup naming the problem instead of serving requests
    # that would fail anyway. Data, not schema: the backend still never
    # changes the schema.
    with transaction() as connection:
        created = auth_service.seed_owner(
            connection, auth_settings.admin_email, auth_settings.admin_password
        )
    if created:
        logger.info("created the owner account from ADMIN_EMAIL and ADMIN_PASSWORD")
    yield


app = FastAPI(title="Lumia", lifespan=lifespan)

register_exception_handlers(app)
app.include_router(api_router)
