import datetime
from sqlalchemy import BigInteger, String, DateTime, ForeignKey, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class UserCanvas(Base):
    __tablename__ = "user_canvases"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_canvas"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    canvas_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    preview_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )

    user: Mapped["User"] = relationship("User")
