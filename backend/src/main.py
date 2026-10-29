from fastapi import APIRouter, FastAPI

from src import health

# Mounted under the same prefix the browser requests, and nginx forwards the
# path untouched, so URLs the backend generates match what the browser sees.
api = APIRouter(prefix="/api")
api.include_router(health.router)

app = FastAPI(title="Lumia")
app.include_router(api)
