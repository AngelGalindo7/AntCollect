import datetime
from sqlalchemy import BigInteger, Integer, String, DateTime, ForeignKey, Text, text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base

class StickerLibrary(Base):
    __tablename__ = "sticker_library"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    petr_dropper: Mapped[str | None] = mapped_column(String(255), nullable=True)
    drop_date: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    added_by_user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    images: Mapped[list["StickerLibraryImage"]] = relationship(
        "StickerLibraryImage", back_populates="sticker", cascade="all, delete-orphan"
    )
    added_by: Mapped["User"] = relationship("User")

class StickerLibraryImage(Base):
    __tablename__ = "sticker_library_images"
    __table_args__ = (
        UniqueConstraint("sticker_id", "order_index", name="uq_sticker_image_order"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sticker_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("sticker_library.id", ondelete="CASCADE"), nullable=False
    )
    asset_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("media_assets.id", ondelete="RESTRICT"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))

    sticker: Mapped["StickerLibrary"] = relationship("StickerLibrary", back_populates="images")
    asset: Mapped["MediaAsset"] = relationship("MediaAsset")
