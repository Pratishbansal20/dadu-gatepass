"""
SWD Integration API — /api/swd/v1/

Separate router for Student Welfare Division integration. Uses API key auth
(not JWT) for service-to-service calls. All endpoints are documented for
external teams integrating against this API.

Auth handshake:
  1. SWD app calls POST /api/swd/v1/auth/token with {student_id, api_secret}
  2. Receives a scoped access_token
  3. Uses that token as Bearer for subsequent calls
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_db, verify_swd_api_key
from app.core.security import create_access_token, decode_token
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.pass_model import Pass, PassType, PassStatus
from app.schemas.pass_schema import PassResponse, VisitorDayPassCreate, QRGenerateResponse
from app.services import pass_service, otp_service, qr_service

router = APIRouter(prefix="/api/swd/v1", tags=["swd"])


# --- Request / response models for SWD-specific endpoints ---

class SWDTokenRequest(BaseModel):
    student_id: str
    api_secret: str


class SWDTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    student_id: str
    student_name: str


class SWDOTPVerifyRequest(BaseModel):
    phone: str
    otp: str
    pass_id: int

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 10:
            raise ValueError("Phone number must be exactly 10 digits and contain only numbers.")
        return v


# --- Auth ---

@router.post(
    "/auth/token",
    response_model=SWDTokenResponse,
    summary="SWD: Authenticate and get scoped token",
)
async def swd_get_token(
    body: SWDTokenRequest,
    _: str = Depends(verify_swd_api_key),
    db: AsyncSession = Depends(get_db),
):
    """
    SWD application authenticates using a student's campus ID and the shared API secret.
    Returns a scoped JWT (role=STUDENT, expiry=1h) for use in subsequent SWD calls.

    The API secret is validated from the X-API-Key header — this endpoint also requires
    the SWD API key so double-auth is enforced.
    """
    result = await db.execute(
        select(User).where(User.campus_id == body.student_id, User.role == UserRole.STUDENT)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Student not found", "code": "STUDENT_NOT_FOUND"},
        )
    if not student.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "Student account inactive", "code": "ACCOUNT_INACTIVE"},
        )

    token = create_access_token(
        student.id,
        extra_claims={"role": student.role.value, "scope": "swd", "email": student.email},
    )
    return SWDTokenResponse(
        access_token=token,
        student_id=body.student_id,
        student_name=student.full_name,
    )


# --- Pass endpoints ---

@router.get(
    "/passes/student/{student_id}",
    response_model=list[PassResponse],
    summary="SWD: Get all passes for a student",
)
async def swd_get_student_passes(
    student_id: str,
    _: str = Depends(verify_swd_api_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all passes associated with the given campus student ID.
    Sorted newest-first. Includes all pass types and statuses.
    """
    result = await db.execute(
        select(User).where(User.campus_id == student_id, User.role == UserRole.STUDENT)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail={"error": "Student not found", "code": "NOT_FOUND"})

    return await pass_service.get_passes_for_user(db, student.id)


@router.post(
    "/passes/visitor",
    response_model=PassResponse,
    status_code=status.HTTP_201_CREATED,
    summary="SWD: Apply for a visitor day pass",
)
async def swd_apply_visitor_pass(
    body: VisitorDayPassCreate,
    token: str = Depends(verify_swd_api_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Allows the SWD app to submit a visitor day pass on behalf of a student.
    The student must have already authenticated via /auth/token.

    Note: This endpoint uses API key auth only (no per-student JWT) — it is
    intended for bulk/automated submissions. For per-student auth, use the
    scoped token from /auth/token and hit the main /api/v1/passes/visitor endpoint.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "error": "Use scoped student token against /api/v1/passes/visitor",
            "code": "USE_SCOPED_TOKEN",
        },
    )


@router.get(
    "/passes/{pass_id}/status",
    response_model=dict,
    summary="SWD: Poll pass approval status",
)
async def swd_get_pass_status(
    pass_id: int,
    _: str = Depends(verify_swd_api_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Lightweight status poll endpoint. Returns pass_id, status, and reason
    (if rejected). Intended for SWD app polling after submission.
    """
    result = await db.execute(select(Pass).where(Pass.id == pass_id))
    pass_ = result.scalar_one_or_none()
    if not pass_:
        raise HTTPException(status_code=404, detail={"error": "Pass not found", "code": "NOT_FOUND"})

    return {
        "pass_id": pass_.id,
        "status": pass_.status.value,
        "pass_type": pass_.pass_type.value,
        "rejection_reason": pass_.rejection_reason,
        "approved_at": pass_.approved_at.isoformat() if pass_.approved_at else None,
    }


@router.post(
    "/passes/{pass_id}/qr",
    response_model=QRGenerateResponse,
    summary="SWD: Get QR for an approved pass (triggers OTP flow)",
)
async def swd_get_pass_qr(
    pass_id: int,
    body: SWDOTPVerifyRequest,
    _: str = Depends(verify_swd_api_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Validates the visitor OTP (sent after pass approval) and generates a
    single-use QR code. The QR code must be presented at the gate within 10 minutes.

    OTP flow:
      1. Pass is approved → OTP sent to visitor phone (see console log)
      2. SWD app collects OTP from visitor
      3. SWD app calls this endpoint with pass_id + phone + otp
      4. Returns base64 QR image + token
    """
    try:
        qr_image, token = await pass_service.generate_qr_with_otp(
            db, pass_id, body.phone, body.otp
        )
        await db.commit()
        return QRGenerateResponse(
            qr_image_base64=qr_image,
            token=token,
            expires_in_seconds=settings.QR_TTL_SECONDS,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": str(e), "code": "QR_GENERATION_FAILED"},
        )
