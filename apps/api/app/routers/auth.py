from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import bcrypt

from ..deps import get_db
from ..models import User  # expects: id, username, role, hashed_password

router = APIRouter(prefix="/auth", tags=["auth"])

# -------- Password utilities (bcrypt) --------

def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


# -------- Schemas --------

class LoginIn(BaseModel):
    username: str
    password: str
    portal: Optional[str] = None  # "BCBA" | "RBT" (just for redirect convenience)

class LoginOut(BaseModel):
    redirect: str
    user_id: int
    username: str
    role: str

class MeOut(BaseModel):
    id: int
    username: str
    role: str


# -------- Helpers --------

def set_session_cookies(resp: Response, user: User) -> None:
    """
    Set session cookies. Role is written in UPPERCASE to align with middleware checks.
    Keep cookie settings dev-friendly (no Secure on HTTP). #20 will harden later.
    """
    role_up = (user.role or "").upper()
    resp.set_cookie("user_id", str(user.id), httponly=True, samesite="lax", path="/")
    resp.set_cookie("role", role_up, httponly=False, samesite="lax", path="/")
    resp.set_cookie("username", user.username, httponly=False, samesite="lax", path="/")

def clear_session_cookies(resp: Response) -> None:
    resp.delete_cookie("user_id", path="/")
    resp.delete_cookie("role", path="/")
    resp.delete_cookie("username", path="/")


# -------- Routes --------

@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    """
    Strict password check using bcrypt. (No plaintext/backdoor.)
    """
    user = db.query(User).filter(User.username == body.username).one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    set_session_cookies(response, user)

    # Redirect to the user's role dashboard; route slugs are lowercase.
    role_slug = (user.role or "").lower() or "rbt"
    redirect = f"/dashboard/{role_slug}"

    return {
        "redirect": redirect,
        "user_id": user.id,
        "username": user.username,
        "role": (user.role or "").upper(),  # echo uppercase to match cookie/middleware
    }

@router.get("/me", response_model=MeOut)
def me(request: Request, db: Session = Depends(get_db)):
    """
    Read user from backend cookies (user_id). No header/query auth.
    """
    uid = request.cookies.get("user_id")
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user = db.query(User).filter(User.id == int(uid)).one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    return {"id": user.id, "username": user.username, "role": (user.role or "").upper()}

@router.post("/logout")
def logout(response: Response):
    clear_session_cookies(response)
    return {"ok": True}
