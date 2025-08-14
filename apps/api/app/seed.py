# apps/api/app/seed.py
from sqlalchemy.orm import Session
from .models import User, Role
from .auth import get_password_hash

def seed_users(db: Session):
    created = False
    if not db.query(User).filter_by(username="Renso").first():
        db.add(User(username="Renso", hashed_password=get_password_hash("1234"), role=Role.BCBA))
        created = True
    if not db.query(User).filter_by(username="Calynte").first():
        db.add(User(username="Calynte", hashed_password=get_password_hash("1234"), role=Role.RBT))
        created = True
    if created:
        db.commit()
