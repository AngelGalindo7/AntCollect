import datetime
import enum
from sqlalchemy import (
    BigInteger, Boolean, DateTime, Integer,
    ForeignKey, String, Text, UniqueConstraint, text
)
from sqlalchemy.dialects.postgresql import JSONB, ENUM
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from backend.database import Base

class AssetStatus(str, enum.Enum):
    PENDING  = "PENDING"
    ATTACHED = "ATTACHED"


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    uploader_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,               
    )

    file_url: Mapped[str] = mapped_column(
        String(1024),
        nullable=False,                          
    )

    json_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    status: Mapped[AssetStatus | None] = mapped_column(
        ENUM(AssetStatus, name="asset_status_enum"),
        nullable=False,                          
        server_default=text("'PENDING'::asset_status_enum"),
    )

    upload_time: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    
    post_images: Mapped[list["PostImage"]] = relationship(
        "PostImage", back_populates="asset"
    )
   

