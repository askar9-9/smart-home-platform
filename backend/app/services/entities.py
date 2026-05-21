from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.eventbus import DomainEvent, event_bus
from app.models import Entity, EntityState, Event, utcnow


async def get_entity_or_404(db: AsyncSession, entity_id: str) -> Entity:
    entity = (await db.execute(select(Entity).where(Entity.entity_id == entity_id))).scalar_one_or_none()
    if entity is None:
        raise HTTPException(404, "Entity not found")
    return entity


async def set_entity_state(
    db: AsyncSession,
    entity: Entity,
    state: str,
    attributes: dict[str, Any] | None = None,
    *,
    source: str = "user",
    user_id: uuid.UUID | None = None,
    automation_id: uuid.UUID | None = None,
    publish: bool = True,
) -> Entity:
    old_state = entity.state
    now = utcnow()
    merged_attributes = dict(entity.attributes_json or {})
    if attributes:
        merged_attributes.update(attributes)
    entity.state = str(state)
    entity.attributes_json = merged_attributes
    entity.updated_at = now
    db.add(EntityState(entity_id=entity.entity_id, state=entity.state, attributes_json=merged_attributes, last_changed=now, last_updated=now))
    db.add(
        Event(
            entity_id=entity.entity_id,
            event_type="state_changed",
            old_state=old_state,
            new_state=entity.state,
            source=source,
            user_id=user_id,
            automation_id=automation_id,
            metadata_json={"attributes": merged_attributes},
            created_at=now,
        )
    )
    await db.flush()
    event = DomainEvent(
        type="state_changed",
        entity_id=entity.entity_id,
        old_state=old_state,
        new_state=entity.state,
        attributes=merged_attributes,
        source=source,
        timestamp=now,
        user_id=user_id,
        automation_id=automation_id,
    )
    if publish:
        await event_bus.publish(event)
    if source != "automation":
        from app.services.automations import evaluate_automations

        await evaluate_automations(db, event)
    return entity
