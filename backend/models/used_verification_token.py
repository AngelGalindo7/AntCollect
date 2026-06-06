from datetime import datetime
from sqlalchemy import Column, String, DateTime
from backend.database import Base


class UsedVerificationToken(Base):
    __tablename__ = "used_verification_tokens"
    jti = Column(String(32), primary_key=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
