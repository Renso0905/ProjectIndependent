# apps/api/app/auth.py
from datetime import datetime, timedelta
from typing import Any, Dict

from jose import jwt
from passlib.context import CryptContext

# bcrypt backend
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: Dict[str, Any],
    secret: str,
    algorithm: str,
    minutes: int = 60,
) -> str:
    """Create a signed JWT with an exp claim."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=minutes)
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, secret, algorithm=algorithm)
    return token


def decode_token(token: str, secret: str, algorithm: str) -> Dict[str, Any]:
    """Decode & verify a JWT; raises on invalid/expired tokens."""
    return jwt.decode(token, secret, algorithms=[algorithm])

