from sqlalchemy import Column, Integer, String, Enum, Date, DateTime, Text
from .db import Base
import enum
from datetime import datetime

class Role(str, enum.Enum):
    BCBA = "BCBA"
    RBT = "RBT"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(Role), nullable=False)

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    birthdate = Column(Date, nullable=False)
    info = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
