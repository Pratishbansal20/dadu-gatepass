from datetime import datetime, timezone, date, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from app.models.pass_model import Pass, PassType, PassStatus
from app.models.user import User, UserRole
from app.schemas.pass_schema import (
    VisitorDayPassCreate,
    ConferencePassCreate,
    PassApprovalRequest,
)
from app.services.audit_service import log_action
from app.services import otp_service, qr_service


async def create_visitor_day_pass(
    db: AsyncSession,
    student: User,
    data: VisitorDayPassCreate,
) -> Pass:
    """Student applies for a visitor day pass. Sent to superintendent for approval."""
    pass_ = Pass(
        pass_type=PassType.VISITOR_DAY,
        status=PassStatus.PENDING,
        applicant_id=student.id,
        visitor_name=data.visitor_name,
        visitor_phone=data.visitor_phone,
        purpose=data.purpose,
        visit_date=data.visit_date,
        entry_time=data.entry_time,
        exit_time=data.exit_time,
    )
    db.add(pass_)
    await db.flush()
    await log_action(
        db, "PASS_CREATED", "pass",
        actor_id=student.id, entity_id=pass_.id,
        metadata={"type": PassType.VISITOR_DAY, "visitor": data.visitor_name},
    )
    return pass_


async def create_conference_pass(
    db: AsyncSession,
    faculty: User,
    data: ConferencePassCreate,
) -> Pass:
    """Faculty applies for a conference participant pass. Sent to conference supervisor."""
    pass_ = Pass(
        pass_type=PassType.CONFERENCE_PARTICIPANT,
        status=PassStatus.PENDING,
        applicant_id=faculty.id,
        visitor_name=data.participant_name,
        visitor_phone=data.participant_phone,
        visitor_email=data.participant_email,
        conference_name=data.conference_name,
        valid_from=data.valid_from,
        valid_until=data.valid_until,
    )
    db.add(pass_)
    await db.flush()
    await log_action(
        db, "PASS_CREATED", "pass",
        actor_id=faculty.id, entity_id=pass_.id,
        metadata={"type": PassType.CONFERENCE_PARTICIPANT, "conference": data.conference_name},
    )
    return pass_


async def approve_pass(
    db: AsyncSession,
    pass_id: int,
    approver: User,
    approval: PassApprovalRequest,
) -> Pass:
    """
    Superintendent or conference supervisor approves/rejects a pass.
    On approval of a visitor day pass, also creates a linked hostel sub-pass
    and triggers the OTP to the visitor's phone.
    """
    stmt = select(Pass).where(Pass.id == pass_id).options(selectinload(Pass.applicant))
    result = await db.execute(stmt)
    pass_ = result.scalar_one_or_none()
    if not pass_:
        raise ValueError("Pass not found")
    if pass_.status != PassStatus.PENDING:
        raise ValueError(f"Pass is already {pass_.status.value}")

    _check_approver_permission(approver, pass_)

    if not approval.approved:
        pass_.status = PassStatus.REJECTED
        pass_.rejection_reason = approval.rejection_reason
        await log_action(
            db, "PASS_REJECTED", "pass",
            actor_id=approver.id, entity_id=pass_.id,
        )
        return pass_

    pass_.status = PassStatus.APPROVED
    pass_.approved_by_id = approver.id
    pass_.approved_at = datetime.now(timezone.utc)

    await log_action(
        db, "PASS_APPROVED", "pass",
        actor_id=approver.id, entity_id=pass_.id,
    )

    # For visitor day passes: create hostel sub-pass + trigger OTP
    if pass_.pass_type == PassType.VISITOR_DAY:
        hostel_sub = Pass(
            pass_type=PassType.HOSTEL_SUB,
            status=PassStatus.APPROVED,
            applicant_id=pass_.applicant_id,
            visitor_name=pass_.visitor_name,
            visitor_phone=pass_.visitor_phone,
            purpose=f"Hostel entry linked to pass #{pass_.id}",
            visit_date=pass_.visit_date,
            entry_time=pass_.entry_time,
            exit_time=pass_.exit_time,
            parent_pass_id=pass_.id,
            approved_by_id=approver.id,
            approved_at=datetime.now(timezone.utc),
        )
        db.add(hostel_sub)
        await db.flush()
        await log_action(
            db, "HOSTEL_SUB_PASS_CREATED", "pass",
            actor_id=approver.id, entity_id=hostel_sub.id,
            metadata={"parent_pass_id": pass_.id},
        )

        if pass_.visitor_phone:
            await otp_service.generate_and_send(pass_.visitor_phone)
            await log_action(
                db, "OTP_SENT", "pass",
                actor_id=approver.id, entity_id=pass_.id,
                metadata={"phone": pass_.visitor_phone},
            )

    # For conference passes: trigger OTP to participant
    elif pass_.pass_type == PassType.CONFERENCE_PARTICIPANT:
        if pass_.visitor_phone:
            await otp_service.generate_and_send(pass_.visitor_phone)
            await log_action(
                db, "OTP_SENT", "pass",
                actor_id=approver.id, entity_id=pass_.id,
                metadata={"phone": pass_.visitor_phone},
            )

    return pass_


def _check_approver_permission(approver: User, pass_: Pass) -> None:
    """Enforce that only the correct role can approve each pass type."""
    allowed = {
        PassType.VISITOR_DAY: [UserRole.HOSTEL_SUPERINTENDENT, UserRole.SUPER_ADMIN],
        PassType.CONFERENCE_PARTICIPANT: [UserRole.CONFERENCE_SUPERVISOR, UserRole.SUPER_ADMIN],
    }
    roles = allowed.get(pass_.pass_type, [UserRole.SUPER_ADMIN])
    if approver.role not in roles:
        raise PermissionError(f"Role {approver.role} cannot approve {pass_.pass_type} passes")


async def generate_qr_with_otp(
    db: AsyncSession,
    pass_id: int,
    phone: str,
    otp: str,
) -> tuple[str, str]:
    """
    Visitor presents OTP at the /verify endpoint. Validates OTP, then generates
    a single-use QR code. Returns (qr_image_base64, token).
    """
    valid = await otp_service.verify(phone, otp)
    if not valid:
        raise ValueError("Invalid or expired OTP")

    stmt = select(Pass).where(Pass.id == pass_id)
    result = await db.execute(stmt)
    pass_ = result.scalar_one_or_none()
    if not pass_:
        raise ValueError("Pass not found")
    if pass_.status not in (PassStatus.APPROVED, PassStatus.ACTIVE):
        raise ValueError(f"Pass is not available for QR generation (status: {pass_.status.value})")

    qr_image, token = await qr_service.generate_qr(pass_.id, phone)
    await log_action(
        db, "QR_GENERATED", "pass",
        entity_id=pass_.id,
        metadata={"phone_last4": phone[-4:]},
    )
    return qr_image, token


async def validate_gate_qr(db: AsyncSession, token: str, gate_officer: User) -> Pass:
    """
    Gate officer scans QR. Validates JWT + Redis presence, marks pass USED.
    Single-use: Redis key deleted immediately on first successful scan.
    """
    payload = await qr_service.validate_and_consume_qr(token)
    if not payload:
        await log_action(
            db, "QR_SCAN_FAILED", "pass",
            actor_id=gate_officer.id,
            metadata={"reason": "invalid_or_expired_token"},
        )
        raise ValueError("QR code is invalid, expired, or already used")

    pass_id = payload["pass_id"]
    stmt = select(Pass).where(Pass.id == pass_id).options(
        selectinload(Pass.applicant),
        selectinload(Pass.child_passes),
    )
    result = await db.execute(stmt)
    pass_ = result.scalar_one_or_none()
    if not pass_:
        raise ValueError("Pass record not found")

    pass_.status = PassStatus.USED
    pass_.used_at = datetime.now(timezone.utc)

    await log_action(
        db, "QR_SCANNED", "pass",
        actor_id=gate_officer.id, entity_id=pass_.id,
        metadata={"visitor": pass_.visitor_name},
    )
    return pass_


async def get_passes_for_user(
    db: AsyncSession,
    user_id: int,
    pass_type: Optional[PassType] = None,
) -> list[Pass]:
    """Retrieve all passes for a given user, optionally filtered by type."""
    stmt = (
        select(Pass)
        .where(Pass.applicant_id == user_id)
        .options(selectinload(Pass.applicant))
        .order_by(Pass.created_at.desc())
    )
    if pass_type:
        stmt = stmt.where(Pass.pass_type == pass_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_pending_passes(
    db: AsyncSession,
    pass_types: list[PassType],
) -> list[Pass]:
    """Fetch all pending passes for the specified types (for approval queues)."""
    stmt = (
        select(Pass)
        .where(
            and_(
                Pass.status == PassStatus.PENDING,
                Pass.pass_type.in_(pass_types),
            )
        )
        .options(selectinload(Pass.applicant))
        .order_by(Pass.created_at.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_active_passes_at_gate(db: AsyncSession) -> list[Pass]:
    """All approved/active passes for today — used by the gate security dashboard."""
    today = date.today()
    stmt = (
        select(Pass)
        .where(
            and_(
                Pass.status.in_([PassStatus.APPROVED, PassStatus.ACTIVE]),
                or_(
                    Pass.visit_date == today,
                    and_(Pass.valid_from <= today, Pass.valid_until >= today),
                ),
            )
        )
        .options(selectinload(Pass.applicant))
        .order_by(Pass.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_permanent_pass(db: AsyncSession, user: User) -> Pass:
    """
    Generate the permanent resident pass for a new user. Called once on account creation.
    No approval needed — goes straight to APPROVED.
    """
    valid_until = date.today() + timedelta(days=365)
    pass_ = Pass(
        pass_type=PassType.PERMANENT_RESIDENT,
        status=PassStatus.APPROVED,
        applicant_id=user.id,
        visitor_name=user.full_name,
        visitor_phone=user.phone,
        purpose="Permanent campus resident",
        valid_from=date.today(),
        valid_until=valid_until,
        approved_at=datetime.now(timezone.utc),
    )
    db.add(pass_)
    await db.flush()
    await log_action(
        db, "PERMANENT_PASS_CREATED", "pass",
        actor_id=user.id, entity_id=pass_.id,
    )
    return pass_
