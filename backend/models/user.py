import datetime
from enum import Enum
from sqlalchemy import BigInteger, Column, Integer, Float, String, ForeignKey, DateTime, JSON, Text,func, text, Boolean, UniqueConstraint
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
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    role: Mapped[UserRole] = mapped_column(
        String(20), nullable=False, default=UserRole.USER, server_default=text("'user'")
    )
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=text('CURRENT_TIMESTAMP'),nullable=False)
    avatar_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    background_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    background_offset_x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    background_offset_y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    background_scale: Mapped[float] = mapped_column(Float, nullable=False, default=1.0, server_default="1")
    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sticker_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
