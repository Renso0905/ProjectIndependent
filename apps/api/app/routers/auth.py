# apps/api/app/routers/auth.py
from typing import Dict
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..db import get_db
from ..settings import settings
from ..auth import verify_password, create_access_token
from ..models import User
from ..deps import current_user

router = APIRouter()

@router.post("/auth/login")
def login(data: Dict[str, str], response: Response, db: Session = Depends(get_db)):
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    portal = (data.get("portal") or "").upper()  # "BCBA" | "RBT" | ""

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    # If portal is supplied, enforce it matches the user's role
    if portal and portal != user.role.value:
        raise HTTPException(status_code=403, detail=f"Use {user.role.value} login")

    token = create_access_token(
        {"sub": user.username, "role": user.role.value},
        settings.jwt_secret,
        settings.jwt_algorithm,
        minutes=settings.jwt_expire_minutes,
    )
    response.set_cookie(
        key="pi_access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # True behind HTTPS in prod
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )
    redirect = "/dashboard/bcba" if user.role.value == "BCBA" else "/dashboard/rbt"
    return {"redirectTo": redirect}

@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie("pi_access_token", path="/")
    return {"ok": True}

@router.get("/auth/me")
def me(user=Depends(current_user)):
    return {"username": user["sub"], "role": user["role"]}
