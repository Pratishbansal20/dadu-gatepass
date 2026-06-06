from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from jose import JWTError, jwt
import bcrypt
from app.core.config import settings


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(subject: Any, extra_claims: dict = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(subject), "exp": expire, "type": "access"}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: Any) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(subject), "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def create_qr_token(pass_id: int, visitor_phone: str) -> str:
    """Create a short-lived signed JWT embedded in QR codes."""
    expire = datetime.now(timezone.utc) + timedelta(seconds=settings.QR_TTL_SECONDS)
    phone_last4 = visitor_phone[-4:] if len(visitor_phone) >= 4 else visitor_phone
    payload = {
        "pass_id": pass_id,
        "visitor_phone_last4": phone_last4,
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "exp": expire,
        "type": "qr",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_qr_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "qr":
            return None
        return payload
    except JWTError:
        return None
