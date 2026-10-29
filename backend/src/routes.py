from fastapi import APIRouter

from src import health
from src.packages.auth.router import router as auth_router

# Mounted under the same prefix the browser requests, and nginx forwards the
# path untouched, so URLs the backend generates match what the browser sees.
api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth_router)
