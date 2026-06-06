from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.core.config import settings
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest, OTPVerifyRequest
from app.schemas.pass_schema import QRGenerateResponse
from app.services import user_service, audit_service
from app.services.pass_service import generate_qr_with_otp
from app.services.otp_service import get_current_otp
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with email/password. Returns access + refresh tokens."""
    user = await user_service.authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Invalid credentials", "code": "INVALID_CREDENTIALS"},
        )

    await audit_service.log_action(
        db, "USER_LOGIN", "user",
        actor_id=user.id, entity_id=user.id,
    )
    await db.commit()

    extra = {"role": user.role.value, "email": user.email}
    return TokenResponse(
        access_token=create_access_token(user.id, extra),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a valid refresh token for new access + refresh tokens."""
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Invalid refresh token", "code": "INVALID_REFRESH_TOKEN"},
        )

    user = await user_service.get_user_by_id(db, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "User not found", "code": "USER_NOT_FOUND"},
        )

    extra = {"role": user.role.value, "email": user.email}
    return TokenResponse(
        access_token=create_access_token(user.id, extra),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/verify-otp", response_model=QRGenerateResponse)
async def verify_otp_and_get_qr(
    body: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Visitor presents OTP at the gate kiosk. Validates OTP and generates
    a single-use QR code valid for 10 minutes.
    """
    try:
        qr_image, token = await generate_qr_with_otp(db, body.pass_id, body.phone, body.otp)
        await db.commit()
        return QRGenerateResponse(
            qr_image_base64=qr_image,
            token=token,
            expires_in_seconds=settings.QR_TTL_SECONDS,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": str(e), "code": "OTP_VERIFICATION_FAILED"},
        )


# Dev-only endpoint — disabled in production
@router.get("/dev/otp/{phone}", include_in_schema=settings.is_development)
async def get_dev_otp(phone: str):
    """[DEV ONLY] Returns the current OTP stored in Redis for a phone number."""
    if not settings.is_development:
        raise HTTPException(status_code=404)
    otp = await get_current_otp(phone)
    if not otp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "No active OTP for this phone", "code": "OTP_NOT_FOUND"},
        )
    return {"phone": phone, "otp": otp}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "phone": current_user.phone,
        "campus_id": current_user.campus_id,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat(),
    }
