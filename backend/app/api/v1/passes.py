from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.dependencies import get_db, get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.pass_model import PassType
from app.schemas.pass_schema import (
    VisitorDayPassCreate,
    ConferencePassCreate,
    PassApprovalRequest,
    PassResponse,
    PermanentPassResponse,
)
from app.services import pass_service, qr_service, audit_service
from app.services.pass_service import create_permanent_pass, get_passes_for_user, get_pending_passes

router = APIRouter(prefix="/passes", tags=["passes"])


@router.get("/permanent", response_model=PermanentPassResponse)
async def get_permanent_pass(
    current_user: User = Depends(require_roles(
        UserRole.STUDENT, UserRole.FACULTY, UserRole.SUPER_ADMIN
    )),
    db: AsyncSession = Depends(get_db),
):
    """Returns the current user's permanent resident pass, generating it if missing."""
    from sqlalchemy import select
    from app.models.pass_model import Pass, PassStatus
    from datetime import date, timedelta

    stmt = select(Pass).where(
        Pass.applicant_id == current_user.id,
        Pass.pass_type == PassType.PERMANENT_RESIDENT,
    )
    result = await db.execute(stmt)
    pass_ = result.scalar_one_or_none()

    if not pass_:
        pass_ = await create_permanent_pass(db, current_user)
        await db.commit()

    qr_image = await qr_service.generate_permanent_pass_qr(
        current_user.id,
        {"campus_id": current_user.campus_id, "name": current_user.full_name, "role": current_user.role.value},
    )

    return PermanentPassResponse(
        pass_id=pass_.id,
        qr_image_base64=qr_image,
        holder_name=current_user.full_name,
        role=current_user.role.value,
        campus_id=current_user.campus_id,
        valid_until=pass_.valid_until or (date.today() + timedelta(days=365)),
    )


@router.post("/visitor", response_model=PassResponse, status_code=status.HTTP_201_CREATED)
async def apply_visitor_pass(
    body: VisitorDayPassCreate,
    current_user: User = Depends(require_roles(UserRole.STUDENT, UserRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Student applies for a visitor day pass."""
    pass_ = await pass_service.create_visitor_day_pass(db, current_user, body)
    await db.commit()
    await db.refresh(pass_)
    return pass_


@router.post("/conference", response_model=PassResponse, status_code=status.HTTP_201_CREATED)
async def apply_conference_pass(
    body: ConferencePassCreate,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Faculty applies for a conference participant pass."""
    pass_ = await pass_service.create_conference_pass(db, current_user, body)
    await db.commit()
    await db.refresh(pass_)
    return pass_


@router.get("/my", response_model=list[PassResponse])
async def my_passes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all passes created by the current user."""
    return await get_passes_for_user(db, current_user.id)


@router.get("/pending/visitor", response_model=list[PassResponse])
async def pending_visitor_passes(
    current_user: User = Depends(require_roles(
        UserRole.HOSTEL_SUPERINTENDENT, UserRole.SUPER_ADMIN
    )),
    db: AsyncSession = Depends(get_db),
):
    """Hostel superintendent: list pending visitor day passes awaiting approval."""
    return await get_pending_passes(db, [PassType.VISITOR_DAY])


@router.get("/pending/conference", response_model=list[PassResponse])
async def pending_conference_passes(
    current_user: User = Depends(require_roles(
        UserRole.CONFERENCE_SUPERVISOR, UserRole.SUPER_ADMIN
    )),
    db: AsyncSession = Depends(get_db),
):
    """Conference supervisor: list pending conference passes awaiting approval."""
    return await get_pending_passes(db, [PassType.CONFERENCE_PARTICIPANT])


@router.patch("/{pass_id}/approve", response_model=PassResponse)
async def approve_or_reject_pass(
    pass_id: int,
    body: PassApprovalRequest,
    current_user: User = Depends(require_roles(
        UserRole.HOSTEL_SUPERINTENDENT,
        UserRole.CONFERENCE_SUPERVISOR,
        UserRole.SUPER_ADMIN,
    )),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject a pending pass. Role must match the pass type."""
    try:
        pass_ = await pass_service.approve_pass(db, pass_id, current_user, body)
        await db.commit()
        await db.refresh(pass_)
        return pass_
    except (ValueError, PermissionError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": str(e), "code": "APPROVAL_FAILED"},
        )


@router.get("/{pass_id}", response_model=PassResponse)
async def get_pass(
    pass_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single pass by ID. Users can only view their own passes unless admin."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.pass_model import Pass

    stmt = select(Pass).where(Pass.id == pass_id).options(selectinload(Pass.applicant))
    result = await db.execute(stmt)
    pass_ = result.scalar_one_or_none()

    if not pass_:
        raise HTTPException(status_code=404, detail={"error": "Pass not found", "code": "NOT_FOUND"})

    is_owner = pass_.applicant_id == current_user.id
    is_privileged = current_user.role in (
        UserRole.HOSTEL_SUPERINTENDENT,
        UserRole.CONFERENCE_SUPERVISOR,
        UserRole.GATE_SECURITY,
        UserRole.SUPER_ADMIN,
    )
    if not is_owner and not is_privileged:
        raise HTTPException(status_code=403, detail={"error": "Forbidden", "code": "FORBIDDEN"})

    return pass_
