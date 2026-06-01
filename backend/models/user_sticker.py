import datetime
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class UserSticker(Base):
    __tablename__ = "user_sticker"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    sticker_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("sticker_library.id", ondelete="SET NULL"), nullable=True
    )
    source_post_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("posts.id", ondelete="SET NULL"), nullable=True
    )
    favorite: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    for_trade: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    condition: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    acquired_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )

    user: Mapped["User"] = relationship("User")
    library_sticker: Mapped["StickerLibrary | None"] = relationship("StickerLibrary")
    source_post: Mapped["Post | None"] = relationship("Post")
    images: Mapped[list["UserStickerImage"]] = relationship(
        "UserStickerImage",
        back_populates="user_sticker",
        cascade="all, delete-orphan",
        order_by="UserStickerImage.order_index",
    )


class UserStickerImage(Base):
    __tablename__ = "user_sticker_image"
    __table_args__ = (
        UniqueConstraint("user_sticker_id", "order_index", name="uq_user_sticker_image_order"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_sticker_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("user_sticker.id", ondelete="CASCADE"), nullable=False
    )
    asset_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("media_assets.id", ondelete="RESTRICT"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("1")
    )

    user_sticker: Mapped["UserSticker"] = relationship("UserSticker", back_populates="images")
    asset: Mapped["MediaAsset"] = relationship("MediaAsset")
