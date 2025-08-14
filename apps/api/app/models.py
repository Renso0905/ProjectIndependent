from datetime import datetime, date
from enum import Enum
from typing import Optional, Any, Dict

from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    Enum as SAEnum,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Role(str, Enum):
    BCBA = "BCBA"
    RBT = "RBT"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(Role), nullable=False)

    def as_dict(self) -> Dict[str, Any]:
        return {"id": self.id, "username": self.username, "role": self.role.value}


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    birthdate = Column(Date, nullable=False)
    info = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    behaviors = relationship("Behavior", back_populates="client", cascade="all, delete-orphan")
    sessions = relationship("BehaviorSession", back_populates="client", cascade="all, delete-orphan")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "birthdate": self.birthdate.isoformat(),
            "info": self.info,
            "created_at": self.created_at.isoformat(),
        }


class DataCollectionMethod(str, Enum):
    FREQUENCY = "FREQUENCY"          # count of occurrences
    DURATION = "DURATION"            # total/avg duration per observation
    INTERVAL = "INTERVAL"            # partial/whole interval; requires interval length
    MTS = "MTS"                      # momentary time sampling; requires interval length


class Behavior(Base):
    __tablename__ = "behaviors"

    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    method = Column(SAEnum(DataCollectionMethod), nullable=False)
    settings = Column(JSON, nullable=True)        # e.g., { "interval_seconds": 30 }
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    client = relationship("Client", back_populates="behaviors")
    events = relationship("BehaviorEvent", back_populates="behavior", cascade="all, delete-orphan")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "client_id": self.client_id,
            "name": self.name,
            "description": self.description,
            "method": self.method.value,
            "settings": self.settings or {},
            "created_at": self.created_at.isoformat(),
        }


class BehaviorSession(Base):
    __tablename__ = "behavior_sessions"

    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    client = relationship("Client", back_populates="sessions")
    events = relationship("BehaviorEvent", back_populates="session", cascade="all, delete-orphan")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "client_id": self.client_id,
            "started_at": self.started_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
        }


class BehaviorEvent(Base):
    __tablename__ = "behavior_events"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("behavior_sessions.id"), nullable=False, index=True)
    behavior_id = Column(Integer, ForeignKey("behaviors.id"), nullable=False, index=True)

    # Basic event taxonomy that covers our UI:
    # FREQUENCY: INC/DEC (+/-1)
    # DURATION: START/STOP (value holds seconds for STOP)
    # INTERVAL/MTS: HIT (an occurrence within/at the interval)
    event_type = Column(String(32), nullable=False)  # "INC" | "DEC" | "START" | "STOP" | "HIT"
    value = Column(Integer, nullable=True)           # e.g., +1 / -1 / duration seconds
    happened_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    extra = Column(JSON, nullable=True)

    session = relationship("BehaviorSession", back_populates="events")
    behavior = relationship("Behavior", back_populates="events")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "behavior_id": self.behavior_id,
            "event_type": self.event_type,
            "value": self.value,
            "happened_at": self.happened_at.isoformat(),
            "extra": self.extra or {},
        }
