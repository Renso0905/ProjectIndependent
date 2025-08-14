# apps/api/app/db.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .settings import settings

# For SQLite we need check_same_thread=False for use across threads
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# FastAPI dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
