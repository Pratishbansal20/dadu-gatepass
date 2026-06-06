from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_roles
from app.models.user import User, UserRole
from app.schemas.rfid import RFIDTagCreate, RFIDTagResponse
from app.services import rfid_service

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.post("/rfid", response_model=RFIDTagResponse, status_code=status.HTTP_201_CREATED)
async def submit_rfid_application(
    body: RFIDTagCreate,
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Faculty submits a vehicle RFID tag for admin approval."""
    tag = await rfid_service.submit_rfid_application(db, current_user, body)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.get("/rfid/my", response_model=list[RFIDTagResponse])
async def my_rfid_tags(
    current_user: User = Depends(require_roles(UserRole.FACULTY, UserRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Returns all RFID tags submitted by the current faculty member."""
    return await rfid_service.get_faculty_rfid_tags(db, current_user.id)


@router.get("/rfid", response_model=list[RFIDTagResponse])
async def all_rfid_tags(
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Admin: list all RFID tag applications."""
    from sqlalchemy import select
    from app.models.rfid import RFIDTag

    result = await db.execute(select(RFIDTag).order_by(RFIDTag.created_at.desc()))
    return list(result.scalars().all())


@router.patch("/rfid/{tag_id}/approve", response_model=RFIDTagResponse)
async def approve_rfid_tag(
    tag_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Admin: activate an RFID tag, making it scannable at the gate."""
    try:
        tag = await rfid_service.approve_rfid_tag(db, tag_id, current_user)
        await db.commit()
        await db.refresh(tag)
        return tag
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": str(e), "code": "RFID_APPROVAL_FAILED"},
        )


@router.patch("/rfid/{tag_id}/revoke", response_model=RFIDTagResponse)
async def revoke_rfid_tag(
    tag_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Admin: revoke an active RFID tag."""
    try:
        tag = await rfid_service.revoke_rfid_tag(db, tag_id, current_user)
        await db.commit()
        await db.refresh(tag)
        return tag
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": str(e), "code": "RFID_REVOKE_FAILED"},
        )
