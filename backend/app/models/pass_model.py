import enum
from datetime import datetime, timezone, date, time
from typing import Optional
from sqlalchemy import String, DateTime, Date, Time, ForeignKey, Text, Enum as SAEnum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class PassType(str, enum.Enum):
    PERMANENT_RESIDENT = "PERMANENT_RESIDENT"
    VISITOR_DAY = "VISITOR_DAY"
    CONFERENCE_PARTICIPANT = "CONFERENCE_PARTICIPANT"
    VEHICLE_RFID = "VEHICLE_RFID"
    HOSTEL_SUB = "HOSTEL_SUB"


class PassStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ACTIVE = "ACTIVE"
    USED = "USED"
    EXPIRED = "EXPIRED"


class Pass(Base):
    __tablename__ = "passes"

    id: Mapped[int] = mapped_column(primary_key=True)
    pass_type: Mapped[PassType] = mapped_column(SAEnum(PassType), nullable=False, index=True)
    status: Mapped[PassStatus] = mapped_column(
        SAEnum(PassStatus), nullable=False, default=PassStatus.PENDING, index=True
    )

    applicant_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    parent_pass_id: Mapped[Optional[int]] = mapped_column(ForeignKey("passes.id"), nullable=True)

    # Visitor / participant info
    visitor_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    visitor_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    visitor_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    purpose: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Conference fields
    conference_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Date / time bounds
    visit_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    valid_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    valid_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    entry_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    exit_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)

    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    applicant = relationship("User", back_populates="passes", foreign_keys=[applicant_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    # Self-referential: a hostel sub-pass links back to its parent visitor pass
    parent_pass = relationship(
        "Pass",
        back_populates="child_passes",
        foreign_keys="[Pass.parent_pass_id]",
        remote_side="[Pass.id]",
    )
    child_passes = relationship(
        "Pass",
        back_populates="parent_pass",
        foreign_keys="[Pass.parent_pass_id]",
    )
