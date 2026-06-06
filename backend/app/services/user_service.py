from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import hash_password, verify_password


async def create_user(db: AsyncSession, data: UserCreate) -> User:
    """Create a new user account. Raises ValueError if email is already registered."""
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise ValueError("Email already registered")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        full_name=data.full_name,
        phone=data.phone,
        campus_id=data.campus_id,
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> Optional[User]:
    """Verify credentials. Returns the User on success, None on failure."""
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def list_users(
    db: AsyncSession,
    role: Optional[UserRole] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[User]:
    """Admin: list all users, optionally filtered by role."""
    stmt = select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    if role:
        stmt = stmt.where(User.role == role)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_user(db: AsyncSession, user_id: int, data: UserUpdate) -> User:
    """Admin: update user profile fields."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("User not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    await db.flush()
    return user
