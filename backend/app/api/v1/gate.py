from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_roles
from app.models.user import User, UserRole
from app.schemas.pass_schema import PassResponse
from app.schemas.rfid import RFIDScanRequest, RFIDScanResponse
from app.services import pass_service, rfid_service, audit_service

router = APIRouter(prefix="/gate", tags=["gate"])

_gate_roles = require_roles(UserRole.GATE_SECURITY, UserRole.SUPER_ADMIN)


@router.post("/scan/qr", response_model=PassResponse)
async def scan_qr_code(
    token: str,
    current_user: User = Depends(_gate_roles),
    db: AsyncSession = Depends(get_db),
):
    """
    Gate officer submits a QR token. Validates signature, checks Redis (single-use),
    marks the pass as USED, and returns full pass details.
    """
    try:
        pass_ = await pass_service.validate_gate_qr(db, token, current_user)
        await db.commit()
        return pass_
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": str(e), "code": "QR_SCAN_FAILED"},
        )


@router.post("/scan/rfid", response_model=RFIDScanResponse)
async def scan_rfid_tag(
    body: RFIDScanRequest,
    current_user: User = Depends(_gate_roles),
    db: AsyncSession = Depends(get_db),
):
    """
    Gate officer submits an RFID tag number. Returns vehicle and faculty info
    if the tag is active. Logs every scan attempt.
    """
    try:
        result = await rfid_service.scan_rfid(db, body.tag_number, current_user)
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": str(e), "code": "RFID_SCAN_FAILED"},
        )


@router.get("/active-passes", response_model=list[PassResponse])
async def active_passes(
    current_user: User = Depends(_gate_roles),
    db: AsyncSession = Depends(get_db),
):
    """Live list of all approved/active passes for today — gate dashboard feed."""
    return await pass_service.get_active_passes_at_gate(db)


@router.get("/today-log", response_model=list[dict])
async def today_entry_log(
    current_user: User = Depends(_gate_roles),
    db: AsyncSession = Depends(get_db),
):
    """Chronological log of all QR scans today (entries processed at the gate)."""
    from datetime import date, datetime, timezone
    from sqlalchemy import select, and_
    from app.models.audit import AuditLog

    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    stmt = (
        select(AuditLog)
        .where(
            and_(
                AuditLog.action == "QR_SCANNED",
                AuditLog.timestamp >= today_start,
            )
        )
        .order_by(AuditLog.timestamp.desc())
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "entity_id": log.entity_id,
            "metadata": log.metadata_json,
            "timestamp": log.timestamp.isoformat(),
        }
        for log in logs
    ]
