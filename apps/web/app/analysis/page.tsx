# apps/api/app/routers/sessions.py
from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from ..db import get_db
from ..models import (
    User, Role, Client, Behavior, Skill,
    BehaviorSession, BehaviorEvent, SkillEvent,
)
from ..deps import (
    get_current_user,
    require_bcba,
    require_rbt_or_bcba,   # RBT or BCBA may collect/view; BCBA only for deletion
)

router = APIRouter(prefix="/sessions", tags=["sessions"])

# ----------------------
# Start session (RBT or BCBA)
# ----------------------
@router.post("/start")
def start_session(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    _user: User = Depends(require_rbt_or_bcba),
):
    client_id = payload.get("client_id")
    date_str = payload.get("date")  # yyyy-mm-dd (retained for UI; we store actual timestamp)
    if not client_id or not date_str:
        raise HTTPException(400, "client_id and date are required")

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    s = BehaviorSession(client_id=client_id, started_at=datetime.utcnow())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s.as_dict()

# ------------------------------------------
# Post behavior events to a session (RBT/BCBA)
# ------------------------------------------
@router.post("/{session_id}/events")
def post_behavior_events(
    session_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    _user: User = Depends(require_rbt_or_bcba),
):
    s = db.query(BehaviorSession).filter(BehaviorSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")

    events = payload.get("events") or []
    created = 0
    for e in events:
        behavior_id = e.get("behavior_id")
        event_type = e.get("event_type")
        value = e.get("value")
        happened_at = e.get("happened_at")
        extra = e.get("extra")

        if not behavior_id or not event_type or not happened_at:
            continue

        be = BehaviorEvent(
            session_id=session_id,
            behavior_id=behavior_id,
            event_type=event_type,
            value=value,
            happened_at=datetime.fromisoformat(happened_at),
            extra=extra or None,
        )
        db.add(be)
        created += 1

    db.commit()
    return {"ok": True, "created": created}

# ---------------------------------------
# Post skill events to a session (RBT/BCBA)
# ---------------------------------------
@router.post("/{session_id}/skill-events")
def post_skill_events(
    session_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    _user: User = Depends(require_rbt_or_bcba),
):
    s = db.query(BehaviorSession).filter(BehaviorSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")

    events = payload.get("events") or []
    created = 0
    for e in events:
        skill_id = e.get("skill_id")
        event_type = e.get("event_type")
        happened_at = e.get("happened_at")

        if not skill_id or not event_type or not happened_at:
            continue

        se = SkillEvent(
            session_id=session_id,
            skill_id=skill_id,
            event_type=event_type,
            happened_at=datetime.fromisoformat(happened_at),
        )
        db.add(se)
        created += 1

    db.commit()
    return {"ok": True, "created": created}

# -------------------
# End session (RBT/BCBA)
# -------------------
@router.post("/{session_id}/end")
def end_session(
    session_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_rbt_or_bcba),
):
    s = db.query(BehaviorSession).filter(BehaviorSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.ended_at:
        return s.as_dict()
    s.ended_at = datetime.utcnow()
    db.add(s)
    db.commit()
    db.refresh(s)
    return s.as_dict()

# ---------------------------------------------------
# List/search sessions by date (and optional client) (RBT/BCBA)
# ---------------------------------------------------
@router.get("")
def list_sessions(
    date_from: Optional[date] = Query(None, description="yyyy-mm-dd"),
    date_to: Optional[date] = Query(None, description="yyyy-mm-dd (inclusive)"),
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_rbt_or_bcba),
):
    q = db.query(BehaviorSession).options(joinedload(BehaviorSession.client))
    if client_id:
        q = q.filter(BehaviorSession.client_id == client_id)
    if date_from:
        q = q.filter(func.date(BehaviorSession.started_at) >= date_from)
    if date_to:
        q = q.filter(func.date(BehaviorSession.started_at) <= date_to)

    sessions = q.order_by(BehaviorSession.started_at.desc()).all()
    out = []
    for s in sessions:
        behavior_count = db.query(func.count(BehaviorEvent.id)).filter(BehaviorEvent.session_id == s.id).scalar() or 0
        skill_count = db.query(func.count(SkillEvent.id)).filter(SkillEvent.session_id == s.id).scalar() or 0
        out.append({
            "id": s.id,
            "client_id": s.client_id,
            "client_name": s.client.name if s.client else None,
            "date": s.started_at.date().isoformat(),
            "started_at": s.started_at.isoformat(),
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "behavior_event_count": behavior_count,
            "skill_event_count": skill_count,
        })
    return out

# ---------------------------------------------------
# Session details grouped by behavior/skill targets (RBT/BCBA)
# ---------------------------------------------------
@router.get("/{session_id}/details")
def session_details(
    session_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_rbt_or_bcba),
):
    s = (
        db.query(BehaviorSession)
        .options(joinedload(BehaviorSession.client))
        .filter(BehaviorSession.id == session_id)
        .first()
    )
    if not s:
        raise HTTPException(404, "Session not found")

    bevts = (
        db.query(BehaviorEvent, Behavior)
        .join(Behavior, Behavior.id == BehaviorEvent.behavior_id)
        .filter(BehaviorEvent.session_id == s.id)
        .order_by(BehaviorEvent.happened_at.asc(), BehaviorEvent.id.asc())
        .all()
    )
    sevts = (
        db.query(SkillEvent, Skill)
        .join(Skill, Skill.id == SkillEvent.skill_id)
        .filter(SkillEvent.session_id == s.id)
        .order_by(SkillEvent.happened_at.asc(), SkillEvent.id.asc())
        .all()
    )

    behaviors: Dict[int, Dict[str, Any]] = {}
    for e, b in bevts:
        group = behaviors.setdefault(
            b.id,
            {"behavior": {"id": b.id, "name": b.name, "method": b.method}, "events": []},
        )
        group["events"].append({
            "id": e.id,
            "event_type": e.event_type,
            "value": e.value,
            "happened_at": e.happened_at.isoformat(),
            "extra": e.extra or None,
        })

    skills: Dict[int, Dict[str, Any]] = {}
    for e, sk in sevts:
        group = skills.setdefault(
            sk.id,
            {"skill": {"id": sk.id, "name": sk.name, "skill_type": sk.skill_type}, "events": []},
        )
        group["events"].append({
            "id": e.id,
            "event_type": e.event_type,
            "happened_at": e.happened_at.isoformat(),
        })

    return {
        "id": s.id,
        "client": {"id": s.client_id, "name": s.client.name if s.client else None},
        "date": s.started_at.date().isoformat(),
        "started_at": s.started_at.isoformat(),
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        "behaviors": list(behaviors.values()),
        "skills": list(skills.values()),
    }

# -----------------------------------
# Delete a single behavior event (BCBA)
# -----------------------------------
@router.delete("/events/behavior/{event_id}", status_code=204)
def delete_behavior_event(
    event_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_bcba),
):
    evt = db.query(BehaviorEvent).filter(BehaviorEvent.id == event_id).first()
    if not evt:
        raise HTTPException(404, "Behavior event not found")
    db.delete(evt)
    db.commit()
    return

# -------------------------------
# Delete a single skill event (BCBA)
# -------------------------------
@router.delete("/events/skill/{event_id}", status_code=204)
def delete_skill_event(
    event_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_bcba),
):
    evt = db.query(SkillEvent).filter(SkillEvent.id == event_id).first()
    if not evt:
        raise HTTPException(404, "Skill event not found")
    db.delete(evt)
    db.commit()
    return

# ------------------------------------------
# Delete an entire session and its data (BCBA)
# ------------------------------------------
@router.delete("/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_bcba),
):
    s = db.query(BehaviorSession).filter(BehaviorSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")

    # Explicit deletes for portability (works even without FK ON DELETE CASCADE)
    db.query(BehaviorEvent).filter(BehaviorEvent.session_id == session_id).delete(synchronize_session=False)
    db.query(SkillEvent).filter(SkillEvent.session_id == session_id).delete(synchronize_session=False)

    db.delete(s)
    db.commit()
    return
