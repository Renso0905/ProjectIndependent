from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, case, distinct
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_bcba
from ..models import (
    Behavior,
    BehaviorEvent,
    BehaviorSession,
    DataCollectionMethod,
    Skill,
    SkillEvent,
)

router = APIRouter()


def _date_col():
    # Group by the calendar date (YYYY-MM-DD) of the session start time
    return func.date(BehaviorSession.started_at)


@router.get("/analysis/behavior/{behavior_id}/session-points")
def behavior_session_points(
    behavior_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_bcba),
):
    """
    Aggregate behavior data by date, returning one point per date.
    - FREQUENCY: sum of INC/DEC values (net count)
    - DURATION:  sum of STOP values (seconds)
    - INTERVAL/MTS: count of HIT events
    """
    b = db.query(Behavior).filter(Behavior.id == behavior_id).first()
    if not b:
        raise HTTPException(404, detail="Behavior not found")

    dcol = _date_col()

    if b.method == DataCollectionMethod.FREQUENCY:
        # Sum the +1/-1 values for INC/DEC; ignore other types
        value_expr = func.coalesce(
            func.sum(
                case(
                    (
                        BehaviorEvent.event_type.in_(("INC", "DEC")),
                        BehaviorEvent.value,
                    ),
                    else_=0,
                )
            ),
            0,
        )
    elif b.method == DataCollectionMethod.DURATION:
        # Sum seconds recorded on STOPs
        value_expr = func.coalesce(
            func.sum(
                case(
                    (BehaviorEvent.event_type == "STOP", BehaviorEvent.value),
                    else_=0,
                )
            ),
            0,
        )
    else:
        # INTERVAL or MTS -> count HIT events
        value_expr = func.coalesce(
            func.sum(case((BehaviorEvent.event_type == "HIT", 1), else_=0)),
            0,
        )

    session_count_expr = func.count(distinct(BehaviorEvent.session_id))

    rows = (
        db.query(
            dcol.label("date"),
            value_expr.label("value"),
            session_count_expr.label("session_count"),
        )
        .join(BehaviorSession, BehaviorEvent.session_id == BehaviorSession.id)
        .filter(BehaviorEvent.behavior_id == behavior_id)
        .group_by(dcol)
        .order_by(dcol.asc())
        .all()
    )

    points: List[Dict[str, Any]] = [
        {
            "date": r.date,
            "value": int(r.value or 0),
            "session_count": int(r.session_count or 0),
        }
        for r in rows
    ]

    return {
        "behavior": {"id": b.id, "name": b.name, "method": b.method.name},
        "points": points,
    }


@router.get("/analysis/skill/{skill_id}/session-points")
def skill_session_points(
    skill_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_bcba),
):
    """
    Aggregate skill data by date as % correct:
      percent = (correct / total) * 100
    """
    s = db.query(Skill).filter(Skill.id == skill_id).first()
    if not s:
        raise HTTPException(404, detail="Skill not found")

    dcol = _date_col()

    correct_expr = func.coalesce(
        func.sum(case((SkillEvent.event_type == "CORRECT", 1), else_=0)), 0
    )
    total_expr = func.count(SkillEvent.id)
    session_count_expr = func.count(distinct(SkillEvent.session_id))

    rows = (
        db.query(
            dcol.label("date"),
            correct_expr.label("correct"),
            total_expr.label("total"),
            session_count_expr.label("session_count"),
        )
        .join(BehaviorSession, SkillEvent.session_id == BehaviorSession.id)
        .filter(SkillEvent.skill_id == skill_id)
        .group_by(dcol)
        .order_by(dcol.asc())
        .all()
    )

    points: List[Dict[str, Any]] = []
    for r in rows:
        correct = int(r.correct or 0)
        total = int(r.total or 0)
        pct = round((correct * 100.0 / total), 2) if total > 0 else 0.0
        points.append(
            {
                "date": r.date,
                "value": pct,
                "session_count": int(r.session_count or 0),
            }
        )

    return {
        "skill": {
            "id": s.id,
            "name": s.name,
            "method": s.method.name,
            "skill_type": s.skill_type.name,  # included for UI prefix (e.g., "LR")
        },
        "points": points,
    }
