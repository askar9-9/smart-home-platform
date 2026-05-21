from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Home


async def get_default_home(db: AsyncSession) -> Home:
    home = (await db.execute(select(Home).order_by(Home.created_at).limit(1))).scalar_one_or_none()
    if home is None:
        raise HTTPException(404, "Home not found")
    return home


async def delete_by_id(db: AsyncSession, model: type[Any], item_id: uuid.UUID) -> None:
    result = await db.execute(delete(model).where(model.id == item_id))
    if result.rowcount == 0:
        raise HTTPException(404, "Resource not found")
    await db.commit()
