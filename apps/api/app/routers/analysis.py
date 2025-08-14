# apps/api/app/routers/analysis.py
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Behavior, BehaviorSession, BehaviorEvent, DataCollectionMethod
from ..deps import require_bcba

router = APIRouter()

def _summarize(events: List[BehaviorEvent], method: DataCollectionMethod) -> int:
    if method == DataCollectionMethod.FREQUENCY:
        return sum(int(e.value or 0) for e in events if e.event_type in {"INC", "DEC"})
    if method == DataCollectionMethod.DURATION:
        return sum(int(e.value or 0) for e in events if e.event_type == "STOP")
    if method in (DataCollectionMethod.INTERVAL, DataCollectionMethod.MTS):
        return sum(1 for e in events if e.event_type == "HIT")
    return 0

@router.get("/analysis/behavior/{behavior_id}/session-points")
def behavior_session_points(
    behavior_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_bcba),
):
    b = db.query(Behavior).filter(Behavior.id == behavior_id).first()
    if not b:
        raise HTTPException(404, detail="Behavior not found")

    # All sessions for the client (oldest -> newest)
    sessions = (
        db.query(BehaviorSession)
        .filter(BehaviorSession.client_id == b.client_id)
        .order_by(BehaviorSession.started_at.asc())
        .all()
    )
    if not sessions:
        return {"behavior": {"id": b.id, "name": b.name, "method": b.method.value}, "points": []}

    sess_ids = {s.id for s in sessions}
    events = (
        db.query(BehaviorEvent)
        .filter(BehaviorEvent.behavior_id == b.id, BehaviorEvent.session_id.in_(sess_ids))
        .all()
    )

    # Group events by session_id
    by_session: Dict[int, List[BehaviorEvent]] = {s.id: [] for s in sessions}
    for e in events:
        if e.session_id in by_session:
            by_session[e.session_id].append(e)

    # Aggregate per date (combine multiple sessions same day)
    # date_key = YYYY-MM-DD
    date_points: Dict[str, Dict[str, Any]] = {}
    sid_to_date: Dict[int, str] = {s.id: s.started_at.date().isoformat() for s in sessions}

    for sid, evs in by_session.items():
        value = _summarize(evs, b.method)
        dkey = sid_to_date[sid]
        if dkey not in date_points:
            date_points[dkey] = {"date": dkey, "value": 0, "session_count": 0}
        date_points[dkey]["value"] += value
        date_points[dkey]["session_count"] += 1

    # Sorted by date ascending
    points = [date_points[k] for k in sorted(date_points.keys())]

    return {
        "behavior": {"id": b.id, "name": b.name, "method": b.method.value},
        "points": points,
    }
