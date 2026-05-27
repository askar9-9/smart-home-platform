from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.dependencies import CurrentUser, Db
from app.services.dashboard import build_dashboard

router = APIRouter()


@router.get("/dashboard")
async def dashboard(_: CurrentUser, db: Db) -> dict[str, Any]:
    return await build_dashboard(db)
