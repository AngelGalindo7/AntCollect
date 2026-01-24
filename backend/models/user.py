import uuid
from sqlalchemy import BigInteger, Column, Integer, String, ForeignKey, DateTime, JSON, Text,func, text, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base
import datetime
from enum import Enum


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] =  mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=text('CURRENT_TIMESTAMP'),nullable=False)
