# apps/api/app/settings.py
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings

# Resolve to the apps/api folder regardless of where uvicorn is started.
BASE_DIR = Path(__file__).resolve().parent.parent
DB_FILE = BASE_DIR / "pi.db"

class Settings(BaseSettings):
    # JWT
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 hours

    # Database – absolute sqlite path so both parent/child uvicorn processes agree
    database_url: str = f"sqlite:///{DB_FILE.as_posix()}"

    # CORS
    cors_allow_origins: Optional[List[str]] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_prefix = "PI_"

# 👇 add this so db.py can `from .settings import settings`
settings = Settings()
