import datetime
from enum import Enum
from sqlalchemy import BigInteger, Column, Integer, String, ForeignKey, DateTime, JSON, Text,func, text, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class UserRole(str, Enum):
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] =  mapped_column(String(50), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[UserRole] = mapped_column(
        String(20), nullable=False, default=UserRole.USER, server_default=text("'user'")
    )
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=text('CURRENT_TIMESTAMP'),nullable=False)
    avatar_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sticker_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
