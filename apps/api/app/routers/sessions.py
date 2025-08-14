# apps/api/app/routers/sessions.py
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import BehaviorSession, BehaviorEvent, Behavior, Client
from ..deps import require_user

router = APIRouter()

@router.post("/sessions/start")
def start_session(payload: Dict[str, Any], db: Session = Depends(get_db), _user=Depends(require_user)):
    client_id = payload.get("client_id")
    if not isinstance(client_id, int):
        raise HTTPException(400, detail="client_id (int) is required")
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, detail="Client not found")
    s = BehaviorSession(client_id=client_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s.as_dict()

@router.post("/sessions/{session_id}/events")
def add_events(session_id: int, payload: Dict[str, Any], db: Session = Depends(get_db), _user=Depends(require_user)):
    s = db.query(BehaviorSession).filter(BehaviorSession.id == session_id).first()
    if not s:
        raise HTTPException(404, detail="Session not found")

    events = payload.get("events") or []
    if not isinstance(events, list):
        raise HTTPException(400, detail="events must be a list")

    created = 0
    for e in events:
        behavior_id = e.get("behavior_id")
        event_type = (e.get("event_type") or "").upper()
        value = e.get("value")
        happened_at_str = e.get("happened_at")
        extra = e.get("extra") or None

        if not isinstance(behavior_id, int) or event_type not in {"INC", "DEC", "START", "STOP", "HIT"}:
            continue

        b = db.query(Behavior).filter(Behavior.id == behavior_id).first()
        if not b or b.client_id != s.client_id:
            continue

        if happened_at_str:
            try:
                happened_at = datetime.fromisoformat(happened_at_str.replace("Z", "+00:00"))
            except Exception:
                happened_at = datetime.utcnow()
        else:
            happened_at = datetime.utcnow()

        ev = BehaviorEvent(
            session_id=s.id,
            behavior_id=behavior_id,
            event_type=event_type,
            value=value if isinstance(value, int) else None,
            happened_at=happened_at,
            extra=extra,
        )
        db.add(ev)
        created += 1

    db.commit()
    return {"ok": True, "created": created}

@router.post("/sessions/{session_id}/end")
def end_session(session_id: int, payload: Optional[Dict[str, Any]] = None, db: Session = Depends(get_db), _user=Depends(require_user)):
    s = db.query(BehaviorSession).filter(BehaviorSession.id == session_id).first()
    if not s:
        raise HTTPException(404, detail="Session not found")

    # Optional final events
    if payload and isinstance(payload.get("events"), list):
        add_events(session_id, {"events": payload["events"]}, db, _user)

    s.ended_at = datetime.utcnow()
    db.add(s)
    db.commit()
    db.refresh(s)
    return s.as_dict()
