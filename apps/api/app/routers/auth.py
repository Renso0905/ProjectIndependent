# apps/api/app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, Role
from ..deps import get_current_user

router = APIRouter()

class LoginIn(BaseModel):
    username: str
    password: str
    portal: str  # "BCBA" | "RBT"

@router.post("/auth/login")
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.username == payload.username).first()
    if not u:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # DEV check (adjust to your real password logic if needed)
    ok = (payload.password == u.hashed_password) or (payload.password == "1234")
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Optional: ensure portal matches role
    if payload.portal.upper() not in (Role.BCBA.value, Role.RBT.value):
        raise HTTPException(status_code=400, detail="Invalid portal")
    if u.role.value != payload.portal.upper():
        # allow, or enforce — here we enforce
        raise HTTPException(status_code=403, detail="Wrong portal for this user")

    # --- Set cookies the deps.get_current_user can read ---
    max_age = 60 * 60 * 24 * 30  # 30 days
    response.set_cookie("user_id", str(u.id), max_age=max_age, httponly=True, samesite="lax", path="/")
    response.set_cookie("username", u.username, max_age=max_age, httponly=True, samesite="lax", path="/")
    response.set_cookie("role", u.role.value, max_age=max_age, httponly=True, samesite="lax", path="/")

    # Also return user info for the frontend to store (header fallback)
    return {
        "redirect": f"/dashboard/{u.role.value.lower()}",
        "user_id": u.id,
        "username": u.username,
        "role": u.role.value,
    }

@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "role": user.role.value}

@router.post("/auth/logout")
def logout(response: Response):
    # clear cookies
    for k in ("user_id", "username", "role"):
        response.delete_cookie(k, path="/")
    return {"ok": True}
