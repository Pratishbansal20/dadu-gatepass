from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.rfid import RFIDTag, RFIDStatus
from app.models.user import User
from app.schemas.rfid import RFIDTagCreate, RFIDScanResponse
from app.services.audit_service import log_action


async def submit_rfid_application(
    db: AsyncSession,
    faculty: User,
    data: RFIDTagCreate,
) -> RFIDTag:
    """Faculty submits an RFID vehicle tag for admin approval."""
    tag = RFIDTag(
        tag_number=data.tag_number,
        vehicle_number=data.vehicle_number,
        vehicle_model=data.vehicle_model,
        faculty_id=faculty.id,
        status=RFIDStatus.PENDING,
    )
    db.add(tag)
    await db.flush()
    await log_action(
        db, "RFID_SUBMITTED", "rfid_tag",
        actor_id=faculty.id, entity_id=tag.id,
        metadata={"tag_number": data.tag_number, "vehicle": data.vehicle_number},
    )
    return tag


async def approve_rfid_tag(
    db: AsyncSession,
    tag_id: int,
    admin: User,
) -> RFIDTag:
    """Admin activates an RFID tag, making it scannable at the gate."""
    result = await db.execute(select(RFIDTag).where(RFIDTag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise ValueError("RFID tag not found")
    if tag.status != RFIDStatus.PENDING:
        raise ValueError(f"Tag is already {tag.status.value}")

    tag.status = RFIDStatus.ACTIVE
    tag.activated_at = datetime.now(timezone.utc)
    await log_action(
        db, "RFID_ACTIVATED", "rfid_tag",
        actor_id=admin.id, entity_id=tag.id,
    )
    return tag


async def revoke_rfid_tag(db: AsyncSession, tag_id: int, admin: User) -> RFIDTag:
    """Admin revokes an active RFID tag."""
    result = await db.execute(select(RFIDTag).where(RFIDTag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise ValueError("RFID tag not found")
    tag.status = RFIDStatus.REVOKED
    await log_action(
        db, "RFID_REVOKED", "rfid_tag",
        actor_id=admin.id, entity_id=tag.id,
    )
    return tag


async def scan_rfid(
    db: AsyncSession,
    tag_number: str,
    gate_officer: User,
) -> RFIDScanResponse:
    """
    Gate security scans an RFID tag. Logs the scan regardless of outcome.
    Raises ValueError if tag is unknown or not active.
    """
    stmt = (
        select(RFIDTag)
        .where(RFIDTag.tag_number == tag_number)
        .options(selectinload(RFIDTag.faculty))
    )
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()

    if not tag:
        await log_action(
            db, "RFID_SCAN_FAILED", "rfid_tag",
            actor_id=gate_officer.id,
            metadata={"tag_number": tag_number, "reason": "not_found"},
        )
        raise ValueError(f"No RFID tag registered with number: {tag_number}")

    await log_action(
        db, "RFID_SCANNED", "rfid_tag",
        actor_id=gate_officer.id, entity_id=tag.id,
        metadata={"tag_number": tag_number, "status": tag.status.value},
    )

    if tag.status != RFIDStatus.ACTIVE:
        raise ValueError(f"Tag is {tag.status.value} — access denied")

    return RFIDScanResponse(
        tag_number=tag.tag_number,
        vehicle_number=tag.vehicle_number,
        vehicle_model=tag.vehicle_model,
        faculty_name=tag.faculty.full_name,
        faculty_email=tag.faculty.email,
        faculty_phone=tag.faculty.phone,
        status=tag.status,
    )


async def get_faculty_rfid_tags(db: AsyncSession, faculty_id: int) -> list[RFIDTag]:
    """Retrieve all RFID tags belonging to a faculty member."""
    result = await db.execute(select(RFIDTag).where(RFIDTag.faculty_id == faculty_id))
    return list(result.scalars().all())
