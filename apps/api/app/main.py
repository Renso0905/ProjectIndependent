# apps/api/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import engine, SessionLocal
from .models import Base

# Routers
from .routers import auth, clients, collect, sessions, analysis

# Optional seeding (tolerant of different signatures)
try:
    from .seed import seed_users  # type: ignore
except Exception:  # pragma: no cover
    seed_users = None  # type: ignore

from sqlalchemy import text

app = FastAPI(title="Project Independent API", version="1.0.0")

# ---- CORS (tune as needed) ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Include routers under /api ----
app.include_router(auth.router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(collect.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    """
    Create tables, apply lightweight migrations, and seed users.
    """
    # 1) Create all tables
    Base.metadata.create_all(bind=engine)

    # 2) Lightweight migration: ensure skills.skill_type exists
    #    (SQLite-friendly; safe to run repeatedly)
    try:
        with engine.begin() as conn:
            cols = [
                row[1]
                for row in conn.execute(text("PRAGMA table_info('skills')")).fetchall()
            ]
            if "skill_type" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE skills "
                        "ADD COLUMN skill_type VARCHAR(32) DEFAULT 'OTHER'"
                    )
                )
    except Exception as e:  # pragma: no cover
        # Non-fatal: log to console and keep going
        print(f"[startup] migration check failed: {e}")

    # 3) Seed default users (BCBA/RBT). Handle varying function signatures.
    if seed_users:
        try:
            # Most common: accepts a DB session
            with SessionLocal() as db:
                seed_users(db)  # type: ignore[arg-type]
        except TypeError:
            # Some projects define seed_users() with no args
            try:
                seed_users()  # type: ignore[call-arg]
            except Exception as e:  # pragma: no cover
                print(f"[startup] seed_users() failed: {e}")
        except Exception as e:  # pragma: no cover
            print(f"[startup] seed_users failed: {e}")


# ---- Health endpoint for the web app ----
@app.get("/api/health")
def health():
    return {"ok": True, "version": app.version}


# (Optional) simple root for quick smoke tests
@app.get("/")
def root():
    return {"ok": True, "api_base": "/api"}
