from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Query, Request
from sse_starlette.sse import EventSourceResponse

from app.core.dependencies import CurrentUser, Db, SseCurrentUser
from app.core.eventbus import event_bus
from app.services.events import query_events

router = APIRouter()


@router.get("/events")
async def list_events(
    _: CurrentUser,
    db: Db,
    entity_id: str | None = None,
    device_id: uuid.UUID | None = None,
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    return await query_events(db, entity_id=entity_id, device_id=device_id, from_=from_, to=to, limit=limit, offset=offset)


@router.get("/events/stream")
async def events_stream(_: SseCurrentUser, request: Request) -> EventSourceResponse:
    async def generator():
        async for event in event_bus.stream():
            if await request.is_disconnected():
                break
            yield {"data": json.dumps(event.sse_payload(), default=str)}

    return EventSourceResponse(generator())
