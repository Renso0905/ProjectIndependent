# apps/api/app/routers/clients.py
from datetime import date
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Client, Behavior, DataCollectionMethod
from ..deps import require_bcba

router = APIRouter()

@router.post("/clients")
def create_client(data: Dict[str, Any], db: Session = Depends(get_db), _user=Depends(require_bcba)):
    name = (data.get("name") or "").strip()
    birthdate = data.get("birthdate")
    info = data.get("info") or None

    if not name or not birthdate:
        raise HTTPException(400, detail="name and birthdate are required")
    try:
        bd = date.fromisoformat(birthdate)
    except ValueError:
        raise HTTPException(400, detail="birthdate must be YYYY-MM-DD")

    c = Client(name=name, birthdate=bd, info=info)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c.as_dict()

@router.get("/clients")
def list_clients(db: Session = Depends(get_db), _user=Depends(require_bcba)):
    items = db.query(Client).order_by(Client.created_at.desc()).all()
    return [c.as_dict() for c in items]

@router.get("/clients/{client_id}")
def get_client(client_id: int, db: Session = Depends(get_db), _user=Depends(require_bcba)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, detail="Client not found")
    return c.as_dict()

# ---- Behaviors (BCBA only) ----
def _validate_behavior_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    name = (data.get("name") or "").strip()
    method_str = (data.get("method") or "").upper()
    description = data.get("description") or None
    settings = data.get("settings") or {}

    try:
        method = DataCollectionMethod[method_str]
    except KeyError:
        raise HTTPException(400, detail="Invalid method. Use FREQUENCY | DURATION | INTERVAL | MTS")

    if method in (DataCollectionMethod.INTERVAL, DataCollectionMethod.MTS):
        secs = settings.get("interval_seconds")
        if not isinstance(secs, int) or secs <= 0:
            raise HTTPException(400, detail="settings.interval_seconds (positive int) is required for INTERVAL/MTS")

    if not name:
        raise HTTPException(400, detail="name is required")

    return {"name": name, "method": method, "description": description, "settings": settings}

@router.post("/clients/{client_id}/behaviors")
def create_behavior(client_id: int, data: Dict[str, Any], db: Session = Depends(get_db), _user=Depends(require_bcba)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(404, detail="Client not found")

    payload = _validate_behavior_payload(data)
    b = Behavior(
        client_id=client_id,
        name=payload["name"],
        description=payload["description"],
        method=payload["method"],
        settings=payload["settings"],
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b.as_dict()

@router.get("/clients/{client_id}/behaviors")
def list_behaviors(client_id: int, db: Session = Depends(get_db), _user=Depends(require_bcba)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, detail="Client not found")
    items = db.query(Behavior).filter(Behavior.client_id == client_id).order_by(Behavior.created_at.asc()).all()
    return [b.as_dict() for b in items]
