from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.dependencies import get_db, require_roles
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.schemas.audit import AuditLogResponse, AuditLogFilters
from app.services import user_service, audit_service, pass_service

router = APIRouter(prefix="/admin", tags=["admin"])

_admin = require_roles(UserRole.SUPER_ADMIN)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    role: Optional[UserRole] = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0),
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all users, optionally filtered by role."""
    return await user_service.list_users(db, role=role, limit=limit, offset=offset)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin creates a new user account. Automatically creates a permanent pass."""
    try:
        user = await user_service.create_user(db, body)
        # Auto-generate permanent pass for students and faculty
        if user.role in (UserRole.STUDENT, UserRole.FACULTY):
            await pass_service.create_permanent_pass(db, user)
        await db.commit()
        await db.refresh(user)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": str(e), "code": "EMAIL_CONFLICT"},
        )


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UserUpdate,
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin updates user profile or activation status."""
    try:
        user = await user_service.update_user(db, user_id, body)
        await db.commit()
        await db.refresh(user)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": str(e), "code": "NOT_FOUND"},
        )


@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def get_audit_logs(
    action: Optional[str] = Query(default=None),
    entity_type: Optional[str] = Query(default=None),
    actor_id: Optional[int] = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0),
    current_user: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: paginated audit log with optional filters."""
    logs = await audit_service.get_audit_logs(
        db,
        action=action,
        entity_type=entity_type,
        actor_id=actor_id,
        limit=limit,
        offset=offset,
    )
    return [
        AuditLogResponse(
            id=log.id,
            actor_id=log.actor_id,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            metadata_json=log.metadata_json,
            timestamp=log.timestamp,
        )
        for log in logs
    ]
