from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Entity, Event
from app.serializers import event_out


async def query_events(
    db: AsyncSession,
    *,
    entity_id: str | None = None,
    device_id: uuid.UUID | None = None,
    from_: datetime | None = None,
    to: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    stmt = select(Event)
    count_stmt = select(func.count(Event.id))
    filters = []
    if entity_id:
        filters.append(Event.entity_id == entity_id)
    if device_id:
        entity_ids = select(Entity.entity_id).where(Entity.device_id == device_id)
        filters.append(Event.entity_id.in_(entity_ids))
    if from_:
        filters.append(Event.created_at >= from_)
    if to:
        filters.append(Event.created_at <= to)
    if filters:
        stmt = stmt.where(and_(*filters))
        count_stmt = count_stmt.where(and_(*filters))
    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt.order_by(Event.created_at.desc()).limit(limit).offset(offset))).scalars().all()
    return {"total": total, "limit": limit, "offset": offset, "events": [event_out(row) for row in rows]}
