from typing import Optional  # (kept if you use elsewhere)
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .db import get_db
from .models import Role, User


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _forbidden(detail: str = "Forbidden") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """
    Resolve the current user **only from backend cookies** set at /auth/login.
    No header-based, query-string, or username-only auth.
    """
    # Primary cookie name; keep 'session_user_id' as an optional back-compat alias if it exists in your app.
    cookie_uid = request.cookies.get("user_id") or request.cookies.get("session_user_id")
    if not cookie_uid or not cookie_uid.isdigit():
        raise _unauthorized()

    user = db.query(User).filter(User.id == int(cookie_uid)).first()
    if not user:
        raise _unauthorized()

    return user


def require_any_user(user: User = Depends(get_current_user)) -> User:
    return user


def require_bcba(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.BCBA:
        raise _forbidden("BCBA role required")
    return user


def require_rbt(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.RBT:
        raise _forbidden("RBT role required")
    return user


def require_rbt_or_bcba(user: User = Depends(get_current_user)) -> User:
    if user.role not in (Role.BCBA, Role.RBT):
        raise _forbidden("Forbidden")
    return user


# Back-compat aliases
current_user = get_current_user
require_user = require_any_user
