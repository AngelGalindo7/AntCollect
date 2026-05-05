import datetime
from sqlalchemy import (
    BigInteger,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    Index,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class Workspace(Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_workspace_user"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    z_counter: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )

    user: Mapped["User"] = relationship("User")
    panels: Mapped[list["Panel"]] = relationship(
        "Panel", back_populates="workspace", cascade="all, delete-orphan"
    )


class Panel(Base):
    __tablename__ = "panels"
    __table_args__ = (
        CheckConstraint("w >= 280", name="ck_panel_min_width"),
        CheckConstraint("h >= 220", name="ck_panel_min_height"),
        CheckConstraint("x >= 0", name="ck_panel_x_nonneg"),
        CheckConstraint("y >= 0", name="ck_panel_y_nonneg"),
        Index("ix_panel_workspace_z", "workspace_id", "z"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    x: Mapped[int] = mapped_column(Integer, nullable=False)
    y: Mapped[int] = mapped_column(Integer, nullable=False)
    w: Mapped[int] = mapped_column(Integer, nullable=False)
    h: Mapped[int] = mapped_column(Integer, nullable=False)
    z: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    title: Mapped[str | None] = mapped_column(String(80), nullable=True)
    accent: Mapped[str | None] = mapped_column(String(16), nullable=True)
    canvas_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    preview_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="panels")
