from fastapi import APIRouter

from src import health
from src.packages.albums.router import router as albums_router
from src.packages.auth.router import router as auth_router
from src.packages.photos.router import router as photos_router

# Mounted under the same prefix the browser requests, and nginx forwards the
# path untouched, so URLs the backend generates match what the browser sees.
api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth_router)
api_router.include_router(albums_router)
api_router.include_router(photos_router)
