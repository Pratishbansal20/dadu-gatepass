import io
import base64
import qrcode
from app.core.redis import get_redis, qr_key
from app.core.security import create_qr_token, decode_qr_token
from app.core.config import settings


def _build_qr_image(data: str) -> str:
    """Render a QR code from data string and return as base64-encoded PNG."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1e293b", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()


async def generate_qr(pass_id: int, visitor_phone: str) -> tuple[str, str]:
    """
    Create a signed QR token, store it in Redis (single-use, TTL-bound),
    and return the base64 QR image alongside the raw token.

    Returns (qr_image_base64, token).
    """
    token = create_qr_token(pass_id, visitor_phone)
    redis = await get_redis()
    await redis.setex(qr_key(token), settings.QR_TTL_SECONDS, str(pass_id))
    qr_image = _build_qr_image(token)
    return qr_image, token


async def validate_and_consume_qr(token: str) -> dict | None:
    """
    Validate QR token JWT signature, confirm Redis key exists, then delete it
    (single-use enforcement). Returns payload dict or None on any failure.
    """
    payload = decode_qr_token(token)
    if not payload:
        return None

    redis = await get_redis()
    key = qr_key(token)
    stored_pass_id = await redis.get(key)
    if not stored_pass_id:
        return None

    await redis.delete(key)
    return payload


async def generate_permanent_pass_qr(user_id: int, payload_data: dict) -> str:
    """
    Generate a long-lived QR image for permanent resident passes.
    Permanent passes embed the user ID in a plain token string (no Redis TTL).
    """
    import json
    data = json.dumps({"type": "permanent", "user_id": user_id, **payload_data})
    return _build_qr_image(data)
