# apps/api/app/deps.py
from typing import Optional
import os

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .db import get_db
from .models import Role, User


def _find_user_by_id_or_username(
    db: Session,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
) -> Optional[User]:
    if user_id is not None:
        u = db.query(User).filter(User.id == user_id).first()
        if u:
            return u
    if username:
        u = db.query(User).filter(User.username == username).first()
        if u:
            return u
    return None


def _h(headers, name: str) -> Optional[str]:
    # Case-insensitive header lookup with a few common variants
    return (
        headers.get(name)
        or headers.get(name.lower())
        or headers.get(name.upper())
        or headers.get(name.replace("-", "_"))
        or headers.get(name.replace("-", "_").lower())
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """
    Resolve the signed-in user from (in order):
      - Headers: X-User-Id / X-Username OR Authorization: Bearer <user_id>
      - Cookies: user_id / session_user_id, username
      - Query params: ?uid=&username=
    """
    debug = os.getenv("DEBUG_AUTH") == "1"

    # HEADERS
    hdr_uid = _h(request.headers, "X-User-Id")
    hdr_un = _h(request.headers, "X-Username")
    auth = _h(request.headers, "Authorization") or ""
    if debug:
        print("[auth] headers",
              {"X-User-Id": hdr_uid, "X-Username": hdr_un, "Authorization": auth[:16] + "..." if auth else ""})

    if hdr_uid and hdr_uid.isdigit():
        u = _find_user_by_id_or_username(db, user_id=int(hdr_uid))
        if u:
            return u
    if hdr_un:
        u = _find_user_by_id_or_username(db, username=hdr_un)
        if u:
            return u
    if auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1].strip()
        if token.isdigit():
            u = _find_user_by_id_or_username(db, user_id=int(token))
            if u:
                return u

    # COOKIES
    cookie_uid = request.cookies.get("user_id") or request.cookies.get("session_user_id")
    cookie_un = request.cookies.get("username")
    if debug:
        print("[auth] cookies", {"user_id": cookie_uid, "username": cookie_un})

    if cookie_uid and cookie_uid.isdigit():
        u = _find_user_by_id_or_username(db, user_id=int(cookie_uid))
        if u:
            return u
    if cookie_un:
        u = _find_user_by_id_or_username(db, username=cookie_un)
        if u:
            return u

    # QUERY PARAMS (handy for quick tests)
    q_uid = request.query_params.get("uid")
    q_un = request.query_params.get("username")
    if debug:
        print("[auth] query", {"uid": q_uid, "username": q_un})

    if q_uid and q_uid.isdigit():
        u = _find_user_by_id_or_username(db, user_id=int(q_uid))
        if u:
            return u
    if q_un:
        u = _find_user_by_id_or_username(db, username=q_un)
        if u:
            return u

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


def require_any_user(user: User = Depends(get_current_user)) -> User:
    return user


def require_bcba(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.BCBA:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="BCBA role required")
    return user


def require_rbt(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.RBT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="RBT role required")
    return user


def require_rbt_or_bcba(user: User = Depends(get_current_user)) -> User:
    if user.role not in (Role.BCBA, Role.RBT):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return user

# Back-compat aliases
current_user = get_current_user
require_user = require_any_user
