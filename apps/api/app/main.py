from fastapi import FastAPI, Depends, HTTPException, Response, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import date
from .db import Base, engine, get_db
from .models import User, Role, Client
from .auth import create_access_token, verify_password, hash_password, decode_token
from .settings import settings

# Fingerprint the running app version so you can see it in /docs
app = FastAPI(title="Project Independent API", version="0.1.0+rtprobe")

# CORS for your Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- DB bootstrap & seed -----
Base.metadata.create_all(bind=engine)

def seed(db: Session):
    if not db.query(User).filter_by(username="Renso").first():
        db.add(User(username="Renso", password_hash=hash_password("1234"), role=Role.BCBA))
    if not db.query(User).filter_by(username="Calynte").first():
        db.add(User(username="Calynte", password_hash=hash_password("1234"), role=Role.RBT))
    db.commit()

with next(get_db()) as _db:
    seed(_db)

# ----- helpers -----
def current_user(req: Request):
    token = req.cookies.get("pi_access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    data = decode_token(token)
    return {"username": data["sub"], "role": data["role"]}

def require_bcba(user = Depends(current_user)):
    if user["role"] != "BCBA":
        raise HTTPException(status_code=403, detail="BCBA role required")
    return user

# ----- API Router (all endpoints under /api) -----
router = APIRouter()

@router.get("/health")
def health_api():
    return {"status": "ok", "scope": "api", "version": app.version}

# -------- AUTH --------
class LoginIn(BaseModel):
    username: str
    password: str
    portal: str  # "bcba" or "rbt"

@router.post("/auth/login")
def login(payload: LoginIn, res: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    if payload.portal.lower() == "bcba" and user.role != Role.BCBA:
        raise HTTPException(status_code=403, detail="RBT accounts must use the RBT login.")

    token = create_access_token(user.username, user.role.value)
    res.set_cookie(
        key="pi_access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # dev
        path="/",
        max_age=60 * settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    redirect_to = "/dashboard/bcba" if (payload.portal.lower() == "bcba" or user.role == Role.BCBA) else "/dashboard/rbt"
    return {"ok": True, "redirectTo": redirect_to}

@router.post("/auth/logout")
def logout(res: Response):
    res.delete_cookie("pi_access_token", path="/")
    return {"ok": True}

@router.get("/auth/me")
def me(user = Depends(current_user)):
    return user

# -------- CLIENTS --------
class ClientIn(BaseModel):
    name: str
    birthdate: date
    info: str | None = None

class ClientOut(BaseModel):
    id: int
    name: str
    birthdate: date
    info: str | None = None

@router.post("/clients", response_model=ClientOut)
def create_client(payload: ClientIn, db: Session = Depends(get_db), user = Depends(require_bcba)):
    c = Client(name=payload.name, birthdate=payload.birthdate, info=payload.info)
    db.add(c)
    db.commit()
    db.refresh(c)
    return ClientOut(id=c.id, name=c.name, birthdate=c.birthdate, info=c.info)

@router.get("/clients", response_model=list[ClientOut])
def list_clients(db: Session = Depends(get_db), user = Depends(require_bcba)):
    rows = db.query(Client).order_by(Client.created_at.desc()).all()
    return [ClientOut(id=r.id, name=r.name, birthdate=r.birthdate, info=r.info) for r in rows]

@router.get("/clients/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db), user = Depends(require_bcba)):
    r = db.get(Client, client_id)
    if not r:
        raise HTTPException(status_code=404, detail="Client not found")
    return ClientOut(id=r.id, name=r.name, birthdate=r.birthdate, info=r.info)

# ---- Debug probe ----
@router.get("/debug/ping")
def ping():
    return {"ok": True}

# Mount all /api endpoints
app.include_router(router, prefix="/api")

# Print routing table at startup so you can see exactly what's registered
@app.on_event("startup")
async def _print_routes():
    print("=== ROUTES (on startup) ===")
    for r in app.router.routes:
        path = getattr(r, "path", None)
        methods = getattr(r, "methods", None)
        methods_str = ",".join(sorted(methods)) if methods else ""
        if path:
            print(f"ROUTE: {path} {methods_str}")
    print("===========================")
