import datetime
from sqlalchemy import BigInteger, String, DateTime, ForeignKey, text, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from backend.database import Base


class TradeRequest(Base):
    __tablename__ = "trade_requests"
    __table_args__ = (
        CheckConstraint(
            "request_type IN ('WANT_TO_TRADE', 'HAVE_WHAT_YOU_NEED')",
            name="ck_trade_request_type",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')",
            name="ck_trade_request_status",
        ),
        Index(
            "idx_trade_requests_pending_unique",
            "requester_id", "target_post_id",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
        Index(
            "idx_trade_requests_recipient_pending",
            "recipient_id", "created_at",
            postgresql_where=text("status = 'PENDING'"),
        ),
        Index(
            "idx_trade_requests_requester",
            "requester_id", "created_at",
        ),
        Index(
            "idx_trade_requests_decline_count",
            "requester_id", "recipient_id",
            postgresql_where=text("status = 'DECLINED'"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    requester_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    recipient_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    target_post_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
    )
    request_type: Mapped[str] = mapped_column(String(20), nullable=False)
    offered_folder_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True
    )
    offered_post_ids: Mapped[Optional[list]] = mapped_column(
        JSONB, nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default=text("'PENDING'")
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    resolved_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
