from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.errors import install_error_handlers
from app.routers.api import api
from app.runtime import prepare_runtime, start_background_tasks, stop_background_tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    await prepare_runtime()
    sim_task, mqtt_task = await start_background_tasks()
    try:
        yield
    finally:
        await stop_background_tasks(sim_task, mqtt_task)


app = FastAPI(title="homeIQ", docs_url="/docs", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.cors_origins == "*" else [item.strip() for item in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)
install_error_handlers(app)
app.include_router(api)
