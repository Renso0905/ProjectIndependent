# apps/api/app/main.py
from datetime import date, datetime
from typing import Dict, Any, Optional

from fastapi import (
    FastAPI,
    APIRouter,
    Depends,
    HTTPException,
    status,
    Request,
    Response,
)
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError
from sqlalchemy.orm import Session

from .db import engine, SessionLocal, get_db
from .models import (
    Base,
    User,
    Client,
    Role,
    Behavior,
    DataCollectionMethod,
    BehaviorSession,
    BehaviorEvent,
)
from .auth import verify_password, get_password_hash, create_access_token, decode_token
from .settings import settings  # singleton Settings()

app = FastAPI(title="Project Independent API", version="0.2.1")

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- DB init & seed ----
Base.metadata.create_all(bind=engine)


def seed(db: Session):
    if not db.query(User).filter_by(username="Renso").first():
        db.add(
            User(
                username="Renso",
                hashed_password=get_password_hash("1234"),
                role=Role.BCBA,
            )
        )
    if not db.query(User).filter_by(username="Calynte").first():
        db.add(
            User(
                username="Calynte",
                hashed_password=get_password_hash("1234"),
                role=Role.RBT,
            )
        )
    db.commit()


with SessionLocal() as _db:
    seed(_db)


# ---- Auth deps ----
def current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("pi_access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    try:
        payload = decode_token(token, settings.jwt_secret, settings.jwt_algorithm)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    return payload


def require_bcba(user=Depends(current_user)):
    if user.get("role") != Role.BCBA.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="BCBA role required"
        )
    return user


def require_user(user=Depends(current_user)):
    # Any authenticated user (BCBA or RBT)
    return user


# ---- API router ----
api = APIRouter(prefix="/api")


@api.get("/health")
def health():
    return {"status": "ok", "version": app.version}


# ===================== AUTH =====================
@api.post("/auth/login")
def login(data: Dict[str, str], response: Response, db: Session = Depends(get_db)):
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    portal = (data.get("portal") or "").upper()  # "BCBA" | "RBT"

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if portal == "BCBA" and user.role != Role.BCBA:
        raise HTTPException(status_code=403, detail="Use RBT login")
    if portal == "RBT" and user.role != Role.RBT:
        raise HTTPException(status_code=403, detail="Use BCBA login")

    token = create_access_token(
        {"sub": user.username, "role": user.role.value},
        settings.jwt_secret,
        settings.jwt_algorithm,
        minutes=settings.jwt_expire_minutes,
    )
    response.set_cookie(
        key="pi_access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # set True behind HTTPS in production
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )
    redirect = "/dashboard/bcba" if user.role == Role.BCBA else "/dashboard/rbt"
    return {"redirectTo": redirect}


@api.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie("pi_access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
def me(user=Depends(current_user)):
    return {"username": user["sub"], "role": user["role"]}


# ===================== CLIENTS (BCBA only) =====================
@api.post("/clients")
def create_client(
    data: Dict[str, Any], db: Session = Depends(get_db), _user=Depends(require_bcba)
):
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


@api.get("/clients")
def list_clients(db: Session = Depends(get_db), _user=Depends(require_bcba)):
    items = db.query(Client).order_by(Client.created_at.desc()).all()
    return [c.as_dict() for c in items]


@api.get("/clients/{client_id}")
def get_client(
    client_id: int, db: Session = Depends(get_db), _user=Depends(require_bcba)
):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, detail="Client not found")
    return c.as_dict()


# ---------- BEHAVIORS (BCBA only) ----------
def _validate_behavior_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    name = (data.get("name") or "").strip()
    method_str = (data.get("method") or "").upper()
    description = data.get("description") or None
    settings = data.get("settings") or {}

    try:
        method = DataCollectionMethod[method_str]
    except KeyError:
        raise HTTPException(
            400, detail="Invalid method. Use FREQUENCY | DURATION | INTERVAL | MTS"
        )

    if method in (DataCollectionMethod.INTERVAL, DataCollectionMethod.MTS):
        secs = settings.get("interval_seconds")
        if not isinstance(secs, int) or secs <= 0:
            raise HTTPException(
                400,
                detail="settings.interval_seconds (positive int) is required for INTERVAL/MTS",
            )

    if not name:
        raise HTTPException(400, detail="name is required")

    return {
        "name": name,
        "method": method,
        "description": description,
        "settings": settings,
    }


@api.post("/clients/{client_id}/behaviors")
def create_behavior(
    client_id: int,
    data: Dict[str, Any],
    db: Session = Depends(get_db),
    _user=Depends(require_bcba),
):
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


@api.get("/clients/{client_id}/behaviors")
def list_behaviors(
    client_id: int, db: Session = Depends(get_db), _user=Depends(require_bcba)
):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, detail="Client not found")
    items = (
        db.query(Behavior)
        .filter(Behavior.client_id == client_id)
        .order_by(Behavior.created_at.asc())
        .all()
    )
    return [b.as_dict() for b in items]


# ===================== COLLECT (any authenticated user) =====================
@api.get("/collect/clients")
def collect_clients(db: Session = Depends(get_db), _user=Depends(require_user)):
    items = db.query(Client).order_by(Client.name.asc()).all()
    return [c.as_dict() for c in items]


@api.get("/collect/clients/{client_id}/behaviors")
def collect_client_behaviors(
    client_id: int, db: Session = Depends(get_db), _user=Depends(require_user)
):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, detail="Client not found")
    items = (
        db.query(Behavior)
        .filter(Behavior.client_id == client_id)
        .order_by(Behavior.created_at.asc())
        .all()
    )
    return [b.as_dict() for b in items]


# ===================== SESSIONS / EVENTS (any authenticated user) =====================
@api.post("/sessions/start")
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


@api.post("/sessions/{session_id}/events")
def add_events(
    session_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    _user=Depends(require_user)
):
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


@api.post("/sessions/{session_id}/end")
def end_session(
    session_id: int,
    payload: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db),
    _user=Depends(require_user),
):
    s = db.query(BehaviorSession).filter(BehaviorSession.id == session_id).first()
    if not s:
        raise HTTPException(404, detail="Session not found")

    if payload and isinstance(payload.get("events"), list):
        add_events(session_id, {"events": payload["events"]}, db, _user)

    s.ended_at = datetime.utcnow()
    db.add(s)
    db.commit()
    db.refresh(s)
    return s.as_dict()


# ---- mount router ----
app.include_router(api)


# ---- optional: log routes on startup ----
@app.on_event("startup")
def _log_routes():
    for r in app.router.routes:
        try:
            path = getattr(r, "path")
            methods = ",".join(getattr(r, "methods", []))
            name = getattr(r, "name")
            print(f"[ROUTE] {methods:<10} {path:<40} {name}")
        except Exception:
            pass
