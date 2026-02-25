import uuid
from sqlalchemy import BigInteger, Column, Integer, String, text, ForeignKey, DateTime, JSON, Text,func, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base
import datetime
from enum import Enum




class PostType(str, Enum):
    collection = "collection"
    looking_for = "looking_for"
    trading = "trading"

class EngagementType(str, Enum):
    like = "like"
    comment = "comment"
    share = "share"
    view = "view"



#For caption use of Text, vs String etc
class Post(Base):
    __tablename__ = "posts"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    caption: Mapped[str] = mapped_column(Text, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('true'))
    public: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('true'))
    images: Mapped[list["PostImage"]] = relationship("PostImage", back_populates="post",cascade="all, delete-orphan")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=text('CURRENT_TIMESTAMP'),nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=text('CURRENT_TIMESTAMP'),nullable=False)
    type: Mapped[PostType] = mapped_column(ENUM(PostType, name="post_type_enum"), 
    nullable=False, 
    server_default=text("'collection'::post_type_enum"))
    
#Change to PostImages
class PostImage(Base):
    __tablename__ = "post_images"
    __table_args__ = (UniqueConstraint("post_id","order_index",name="uq_post_image_order"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('1'))
    #filename: Mapped[str] = mapped_column(String(255), nullable=False) 
    #json_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    #upload_time: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=text('CURRENT_TIMESTAMP'),nullable=False) 
    asset_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("media_assets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    post: Mapped["Post"] = relationship("Post", back_populates="images")
    asset: Mapped["MediaAsset | None"] = relationship("MediaAsset", back_populates="post_images")






class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="unique_user_post_like"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    liked_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False)

class PostComment(Base):
    __tablename__ = "post_comments"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False)

class EngagementLog(Base):
    __tablename__ = "engagement_logs"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Using the ENUM for specific event tracking
    event_type: Mapped[EngagementType] = mapped_column(
        ENUM(EngagementType, name="engagement_type_enum"), 
        nullable=False
    )
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=True
    )
