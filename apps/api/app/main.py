# apps/api/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import engine, SessionLocal
from .models import Base
from .settings import settings
from .seed import seed_users

# Routers
from .routers.auth import router as auth_router
from .routers.clients import router as clients_router
from .routers.collect import router as collect_router
from .routers.sessions import router as sessions_router

app = FastAPI(title="Project Independent API", version="0.2.1")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB init
Base.metadata.create_all(bind=engine)

# Seed on startup
@app.on_event("startup")
def _seed():
    with SessionLocal() as db:
        seed_users(db)

# Health
@app.get("/api/health")
def health():
    return {"status": "ok", "version": app.version}

# Mount routers (paths unchanged)
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(clients_router, prefix="/api", tags=["clients"])
app.include_router(collect_router, prefix="/api", tags=["collect"])
app.include_router(sessions_router, prefix="/api", tags=["sessions"])
