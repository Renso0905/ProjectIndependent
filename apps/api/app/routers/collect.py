from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_rbt_or_bcba
from ..models import Client, Behavior, Skill  # <-- ensure Skill is imported

router = APIRouter()

@router.get("/collect/clients")
def list_collect_clients(db: Session = Depends(get_db), _user=Depends(require_rbt_or_bcba)):
    rows: List[Client] = db.query(Client).order_by(Client.name.asc()).all()
    return [c.as_dict() for c in rows]

@router.get("/collect/clients/{client_id}/behaviors")
def list_client_behaviors(client_id: int, db: Session = Depends(get_db), _user=Depends(require_rbt_or_bcba)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(404, detail="Client not found")
    rows: List[Behavior] = (
        db.query(Behavior)
        .filter(Behavior.client_id == client_id)
        .order_by(Behavior.created_at.asc())
        .all()
    )
    return [b.as_dict() for b in rows]

@router.get("/collect/clients/{client_id}/skills")
def list_client_skills(client_id: int, db: Session = Depends(get_db), _user=Depends(require_rbt_or_bcba)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(404, detail="Client not found")
    rows: List[Skill] = (
        db.query(Skill)
        .filter(Skill.client_id == client_id)
        .order_by(Skill.created_at.asc())
        .all()
    )
    # IMPORTANT: returns skill_type via Skill.as_dict()
    return [s.as_dict() for s in rows]
