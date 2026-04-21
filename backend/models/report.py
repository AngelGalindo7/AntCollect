import datetime
from enum import Enum

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class ReportTargetType(str, Enum):
    post = "post"
    user = "user"


class ReportReason(str, Enum):
    spam = "spam"
    inappropriate = "inappropriate"
    harassment = "harassment"
    copyright = "copyright"
    other = "other"


class ReportStatus(str, Enum):
    pending = "pending"
    reviewed = "reviewed"
    dismissed = "dismissed"
    actioned = "actioned"


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    reporter_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Polymorphic target — validated in router, no DB-level FK so we can extend to
    # other entity types (user, comment, etc.) without schema changes.
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'pending'")
    )
    # Reserved for future AI moderation pipeline — NULL until AI scores the report.
    ai_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    reviewed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
