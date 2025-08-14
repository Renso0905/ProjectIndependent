# apps/api/app/routers/collect.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Client, Behavior
from ..deps import require_user

router = APIRouter()

@router.get("/collect/clients")
def collect_clients(db: Session = Depends(get_db), _user=Depends(require_user)):
    items = db.query(Client).order_by(Client.name.asc()).all()
    return [c.as_dict() for c in items]

@router.get("/collect/clients/{client_id}/behaviors")
def collect_client_behaviors(client_id: int, db: Session = Depends(get_db), _user=Depends(require_user)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, detail="Client not found")
    items = db.query(Behavior).filter(Behavior.client_id == client_id).order_by(Behavior.created_at.asc()).all()
    return [b.as_dict() for b in items]
