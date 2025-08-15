from datetime import datetime, date
from enum import Enum
from typing import Any, Dict

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Date,
    Enum as SAEnum,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# --------------------
# Roles / Auth
# --------------------
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


# --------------------
# Clients
# --------------------
class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    birthdate = Column(Date, nullable=False)
    info = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    behaviors = relationship("Behavior", back_populates="client", cascade="all, delete-orphan")
    sessions = relationship("BehaviorSession", back_populates="client", cascade="all, delete-orphan")
    skills = relationship("Skill", back_populates="client", cascade="all, delete-orphan")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "birthdate": self.birthdate.isoformat(),
            "info": self.info,
            "created_at": self.created_at.isoformat(),
        }


# --------------------
# Behavior Tracking
# --------------------
class DataCollectionMethod(str, Enum):
    FREQUENCY = "FREQUENCY"   # count of occurrences
    DURATION = "DURATION"     # total seconds per day/session
    INTERVAL = "INTERVAL"     # partial/whole interval hits
    MTS = "MTS"               # momentary time sampling hits


class Behavior(Base):
    __tablename__ = "behaviors"

    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    method = Column(SAEnum(DataCollectionMethod), nullable=False)
    settings = Column(JSON, nullable=True)  # e.g., {"interval_seconds": 30}
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
    skill_events = relationship("SkillEvent", back_populates="session", cascade="all, delete-orphan")

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

    # FREQUENCY: INC/DEC (+/-1)
    # DURATION: START/STOP (value holds seconds for STOP)
    # INTERVAL/MTS: HIT (occurrence in interval / at moment)
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


# --------------------
# Skill Acquisition
# --------------------
class SkillMethod(str, Enum):
    PERCENTAGE = "PERCENTAGE"  # + correct / (correct + wrong)


class SkillType(str, Enum):
    LR = "LR"        # Listener Responding
    MAND = "MAND"    # Manding
    TACT = "TACT"    # Tacting
    IV = "IV"        # Intraverbal
    MI = "MI"        # Motor Imitation
    PLAY = "PLAY"    # Play/Leisure
    VP = "VP"        # Visual Perception
    ADL = "ADL"      # Adaptive / Self-Help
    SOC = "SOC"      # Social
    ACAD = "ACAD"    # Academic
    OTHER = "OTHER"  # Other


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    method = Column(SAEnum(SkillMethod), nullable=False, default=SkillMethod.PERCENTAGE)
    skill_type = Column(SAEnum(SkillType), nullable=False, default=SkillType.OTHER)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    client = relationship("Client", back_populates="skills")
    events = relationship("SkillEvent", back_populates="skill", cascade="all, delete-orphan")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "client_id": self.client_id,
            "name": self.name,
            "description": self.description,
            "method": self.method.value,
            "skill_type": self.skill_type.value,
            "created_at": self.created_at.isoformat(),
        }


class SkillEvent(Base):
    __tablename__ = "skill_events"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("behavior_sessions.id"), nullable=False, index=True)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False, index=True)
    event_type = Column(String(16), nullable=False)  # "CORRECT" | "WRONG"
    happened_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("BehaviorSession", back_populates="skill_events")
    skill = relationship("Skill", back_populates="events")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "skill_id": self.skill_id,
            "event_type": self.event_type,
            "happened_at": self.happened_at.isoformat(),
        }
