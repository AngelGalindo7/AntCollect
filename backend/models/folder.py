import datetime
from sqlalchemy import BigInteger, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_post_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("posts.id", ondelete="SET NULL"), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False)

    folder_posts: Mapped[list["FolderPost"]] = relationship("FolderPost", back_populates="folder", cascade="all, delete-orphan")


class FolderPost(Base):
    __tablename__ = "folder_posts"
    __table_args__ = (
        UniqueConstraint("folder_id", "post_id", name="uq_folder_post"),
        UniqueConstraint("folder_id", "order_index", name="uq_folder_post_order"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    folder_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("folders.id", ondelete="CASCADE"), nullable=False)
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    added_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False)

    folder: Mapped["Folder"] = relationship("Folder", back_populates="folder_posts")
    post: Mapped["Post"] = relationship("Post")
