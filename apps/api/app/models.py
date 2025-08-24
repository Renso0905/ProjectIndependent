# apps/api/app/models.py
from __future__ import annotations

from datetime import datetime, date
from typing import Optional, Any, Dict, List

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Date,
    ForeignKey,
    JSON,
    Text,
    create_engine,
    Boolean,
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


# ---- Enums (as simple string constants for portability) ----
class Role:
    BCBA = "BCBA"
    RBT = "RBT"


class DataCollectionMethod:
    FREQUENCY = "FREQUENCY"
    DURATION = "DURATION"
    INTERVAL = "INTERVAL"
    MTS = "MTS"


class BehaviorEventType:
    INC = "INC"
    DEC = "DEC"
    START = "START"
    STOP = "STOP"
    HIT = "HIT"


class SkillMethod:
    PERCENTAGE = "PERCENTAGE"


class SkillType:
    LR = "LR"
    MAND = "MAND"
    TACT = "TACT"
    IV = "IV"
    MI = "MI"
    PLAY = "PLAY"
    VP = "VP"
    ADL = "ADL"
    SOC = "SOC"
    ACAD = "ACAD"
    OTHER = "OTHER"


# ---- Models ----
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default=Role.RBT)

    def as_dict(self) -> Dict[str, Any]:
        return {"id": self.id, "username": self.username, "role": self.role}


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    birthdate = Column(Date, nullable=False)
    info = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    behaviors = relationship("Behavior", back_populates="client", cascade="all, delete-orphan")
    skills = relationship("Skill", back_populates="client", cascade="all, delete-orphan")
    sessions = relationship("BehaviorSession", back_populates="client", cascade="all, delete-orphan")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "birthdate": self.birthdate.isoformat(),
            "info": self.info,
            "created_at": self.created_at.isoformat(),
        }


class Behavior(Base):
    __tablename__ = "behaviors"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    method = Column(String, nullable=False)  # FREQUENCY/DURATION/INTERVAL/MTS
    settings = Column(JSON, nullable=False, default={})
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    client = relationship("Client", back_populates="behaviors")
    events = relationship("BehaviorEvent", back_populates="behavior", cascade="all, delete-orphan")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "client_id": self.client_id,
            "name": self.name,
            "description": self.description,
            "method": self.method,
            "settings": self.settings or {},
            "created_at": self.created_at.isoformat(),
        }


class BehaviorSession(Base):
    __tablename__ = "behavior_sessions"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    client = relationship("Client", back_populates="sessions")

    # relationships enabling cascade delete of events if the DB honors it;
    # also mirrored by explicit deletes in routers for portability.
    behavior_events = relationship(
        "BehaviorEvent",
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    skill_events = relationship(
        "SkillEvent",
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "client_id": self.client_id,
            "started_at": self.started_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
        }


class BehaviorEvent(Base):
    __tablename__ = "behavior_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("behavior_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    behavior_id = Column(Integer, ForeignKey("behaviors.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)  # INC/DEC/START/STOP/HIT
    value = Column(Integer, nullable=True)      # used for INC/DEC counts or STOP seconds
    happened_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    extra = Column(JSON, nullable=True)

    session = relationship("BehaviorSession", back_populates="behavior_events")
    behavior = relationship("Behavior", back_populates="events")


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    method = Column(String, nullable=False, default=SkillMethod.PERCENTAGE)
    skill_type = Column(String, nullable=False, default=SkillType.OTHER)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    client = relationship("Client", back_populates="skills")
    events = relationship("SkillEvent", back_populates="skill", cascade="all, delete-orphan")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "client_id": self.client_id,
            "name": self.name,
            "description": self.description,
            "method": self.method,
            "skill_type": self.skill_type,
            "created_at": self.created_at.isoformat(),
        }


class SkillEvent(Base):
    __tablename__ = "skill_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("behavior_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)  # CORRECT/WRONG
    happened_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    session = relationship("BehaviorSession", back_populates="skill_events")
    skill = relationship("Skill", back_populates="events")
