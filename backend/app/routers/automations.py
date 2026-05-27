from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import func, select

from app.models import Automation
from app.core.dependencies import CurrentUser, Db
from app.schemas import AutomationCreate, AutomationUpdate
from app.serializers import automation_out
from app.services.automations import run_automation
from app.services.common import delete_by_id, get_default_home

router = APIRouter()


@router.get("/automations")
async def list_automations(
    _: CurrentUser,
    db: Db,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    stmt = select(Automation).order_by(Automation.created_at)
    total = (await db.execute(select(func.count(Automation.id)))).scalar_one()
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return {"total": total, "limit": limit, "offset": offset, "automations": [automation_out(row) for row in rows]}


@router.post("/automations", status_code=201)
async def create_automation(payload: AutomationCreate, _: CurrentUser, db: Db) -> dict[str, Any]:
    home = await get_default_home(db)
    automation = Automation(
        home_id=home.id,
        trigger_json=payload.trigger,
        condition_json=payload.condition,
        action_json=payload.action,
        **payload.model_dump(exclude={"trigger", "condition", "action"}),
    )
    db.add(automation)
    await db.commit()
    await db.refresh(automation)
    return automation_out(automation)


@router.get("/automations/{automation_id}")
async def get_automation(automation_id: uuid.UUID, _: CurrentUser, db: Db) -> dict[str, Any]:
    automation = await db.get(Automation, automation_id)
    if automation is None:
        raise HTTPException(404, "Automation not found")
    return automation_out(automation)


@router.patch("/automations/{automation_id}")
async def update_automation(automation_id: uuid.UUID, payload: AutomationUpdate, _: CurrentUser, db: Db) -> dict[str, Any]:
    automation = await db.get(Automation, automation_id)
    if automation is None:
        raise HTTPException(404, "Automation not found")
    mapping = {"trigger": "trigger_json", "condition": "condition_json", "action": "action_json"}
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(automation, mapping.get(key, key), value)
    await db.commit()
    await db.refresh(automation)
    return automation_out(automation)


@router.delete("/automations/{automation_id}", status_code=204)
async def delete_automation(automation_id: uuid.UUID, _: CurrentUser, db: Db) -> Response:
    await delete_by_id(db, Automation, automation_id)
    return Response(status_code=204)


@router.post("/automations/{automation_id}/run")
async def run_automation_endpoint(automation_id: uuid.UUID, _: CurrentUser, db: Db) -> dict[str, Any]:
    automation = await db.get(Automation, automation_id)
    if automation is None:
        raise HTTPException(404, "Automation not found")
    run = await run_automation(db, automation, triggered_by="manual")
    await db.commit()
    return {"ok": True, "run_id": str(run.id), "automation_id": str(automation.id), "triggered_at": run.started_at}
