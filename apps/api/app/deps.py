# apps/api/app/deps.py
from typing import Dict, Any
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError

from .settings import settings
from .auth import decode_token
from .models import Role

def current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("pi_access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(token, settings.jwt_secret, settings.jwt_algorithm)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload

def require_bcba(user=Depends(current_user)):
    if user.get("role") != Role.BCBA.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="BCBA role required")
    return user

def require_user(user=Depends(current_user)):
    # Any authenticated user (BCBA or RBT)
    return user
