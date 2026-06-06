import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class RFIDStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"


class RFIDTag(Base):
    __tablename__ = "rfid_tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    tag_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    vehicle_number: Mapped[str] = mapped_column(String(50), nullable=False)
    vehicle_model: Mapped[str] = mapped_column(String(100), nullable=False)
    faculty_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[RFIDStatus] = mapped_column(
        SAEnum(RFIDStatus), nullable=False, default=RFIDStatus.PENDING
    )
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    faculty = relationship("User", back_populates="rfid_tags")
