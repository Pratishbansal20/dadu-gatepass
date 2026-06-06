import random
from app.core.redis import get_redis, otp_key
from app.core.config import settings


async def generate_and_send(phone: str) -> str:
    """
    Generate a 6-digit OTP, store in Redis with TTL, and log to console.
    In production, replace the print with an actual SMS provider call.
    """
    otp = str(random.randint(100000, 999999))
    redis = await get_redis()
    await redis.setex(otp_key(phone), settings.OTP_TTL_SECONDS, otp)
    print(f"\n{'='*50}")
    print(f"[OTP SERVICE] Phone: {phone} | OTP: {otp}")
    print(f"{'='*50}\n")
    return otp


async def verify(phone: str, otp: str) -> bool:
    """
    Validate the OTP against Redis. Deletes the key on success (single-use).
    Returns False if OTP is wrong or has expired.
    """
    redis = await get_redis()
    key = otp_key(phone)
    stored = await redis.get(key)
    if not stored or stored != otp:
        return False
    await redis.delete(key)
    return True


async def get_current_otp(phone: str) -> str | None:
    """Retrieve the active OTP for a phone number (dev-only endpoint helper)."""
    redis = await get_redis()
    return await redis.get(otp_key(phone))
