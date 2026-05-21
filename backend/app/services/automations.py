from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.eventbus import DomainEvent, event_bus
from app.models import Automation, AutomationRun, Entity, Event, utcnow
from app.services.actions import call_action


def condition_matches(entity: Entity | None, condition: dict[str, Any] | None) -> bool:
    if not condition:
        return True
    if entity is None:
        return False
    op = condition.get("operator", "eq")
    expected = condition.get("value")
    actual: Any = entity.state
    try:
        actual_num = float(actual)
        expected_num = float(expected)
    except (TypeError, ValueError):
        actual_num = expected_num = None
    if op == "eq":
        return str(actual) == str(expected)
    if op == "ne":
        return str(actual) != str(expected)
    if op == "lt":
        return actual_num is not None and expected_num is not None and actual_num < expected_num
    if op == "gt":
        return actual_num is not None and expected_num is not None and actual_num > expected_num
    return False


async def evaluate_automations(db: AsyncSession, event: DomainEvent) -> None:
    automations = (
        await db.execute(select(Automation).where(Automation.is_enabled.is_(True), Automation.trigger_json["type"].astext == "state_changed"))
    ).scalars()
    for automation in automations:
        trigger = automation.trigger_json or {}
        if trigger.get("entity_id") != event.entity_id:
            continue
        if trigger.get("to") is not None and str(trigger["to"]) != str(event.new_state):
            continue
        condition = automation.condition_json
        condition_entity = None
        if condition and condition.get("entity_id"):
            condition_entity = (await db.execute(select(Entity).where(Entity.entity_id == condition["entity_id"]))).scalar_one_or_none()
        if not condition_matches(condition_entity, condition):
            continue
        await run_automation(db, automation, triggered_by=f"state_changed:{event.entity_id}")


async def run_automation(db: AsyncSession, automation: Automation, triggered_by: str = "manual") -> AutomationRun:
    started = utcnow()
    run = AutomationRun(automation_id=automation.id, triggered_by=triggered_by, status="running", started_at=started)
    db.add(run)
    await db.flush()
    try:
        action = automation.action_json or {}
        await call_action(
            db,
            action.get("domain"),
            action.get("action"),
            action.get("target") or {"entity_id": action.get("target_entity_id")},
            action.get("data") or {},
            source="automation",
            automation_id=automation.id,
        )
        run.status = "completed"
        run.finished_at = utcnow()
        automation.last_triggered = started
        db.add(
            Event(
                event_type="automation_triggered",
                source="automation",
                automation_id=automation.id,
                metadata_json={"triggered_by": triggered_by},
                created_at=started,
            )
        )
        await event_bus.publish(DomainEvent(type="automation_triggered", automation_id=automation.id, timestamp=started, metadata={"triggered_by": triggered_by}))
    except Exception:
        run.status = "failed"
        run.finished_at = utcnow()
        raise
    finally:
        await db.flush()
    return run
