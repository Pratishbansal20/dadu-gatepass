import redis.asyncio as aioredis
from app.core.config import settings

_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def close_redis():
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None


# Key builders — keep all key patterns in one place

def otp_key(phone: str) -> str:
    return f"otp:{phone}"


def qr_key(token: str) -> str:
    return f"qr:{token}"


def permanent_pass_key(user_id: int) -> str:
    return f"perm_pass:{user_id}"
