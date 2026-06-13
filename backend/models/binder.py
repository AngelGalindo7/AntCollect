import datetime
from sqlalchemy import (
    BigInteger,
    Integer,
    String,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class Binder(Base):
    __tablename__ = "binder"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_binder_user"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )

    user: Mapped["User"] = relationship("User")
    pages: Mapped[list["BinderPage"]] = relationship(
        "BinderPage",
        back_populates="binder",
        cascade="all, delete-orphan",
        order_by="BinderPage.page_index",
    )


class BinderPage(Base):
    __tablename__ = "binder_page"
    __table_args__ = (
        CheckConstraint("rows >= 1 AND rows <= 8", name="ck_binder_page_rows"),
        CheckConstraint("cols >= 1 AND cols <= 8", name="ck_binder_page_cols"),
        UniqueConstraint("binder_id", "page_index", name="uq_binder_page_index"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    binder_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("binder.id", ondelete="CASCADE"), nullable=False
    )
    page_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(80), nullable=True)
    rows: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("3"))
    cols: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("3"))
    background: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )

    binder: Mapped["Binder"] = relationship("Binder", back_populates="pages")
    # FK is ON DELETE SET NULL — deleting a page returns its stickers to the unfiled
    # collection (passive_deletes lets the DB do it instead of the ORM nulling each row).
    stickers: Mapped[list["UserSticker"]] = relationship(
        "UserSticker",
        back_populates="binder_page",
        order_by="UserSticker.slot_index",
        passive_deletes=True,
    )
