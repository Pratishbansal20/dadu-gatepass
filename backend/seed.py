"""
Seed script — creates demo users for all roles and their permanent passes.
Run: python seed.py
Docker: docker-compose exec backend python seed.py

Idempotent — safe to run multiple times (skips existing emails).
"""
import asyncio
from datetime import date, timedelta, timezone, datetime
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.models.base import Base
from app.models.user import User, UserRole
from app.models.pass_model import Pass, PassType, PassStatus

DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

SEED_USERS = [
    {
        "email": "admin@bits.ac.in",
        "password": "Admin@123",
        "role": UserRole.SUPER_ADMIN,
        "full_name": "System Administrator",
        "phone": "9000000001",
        "campus_id": "ADMIN001",
    },
    {
        "email": "student@bits.ac.in",
        "password": "Student@123",
        "role": UserRole.STUDENT,
        "full_name": "Arjun Sharma",
        "phone": "9000000002",
        "campus_id": "2021A7PS001P",
    },
    {
        "email": "faculty@bits.ac.in",
        "password": "Faculty@123",
        "role": UserRole.FACULTY,
        "full_name": "Dr. Priya Nair",
        "phone": "9000000003",
        "campus_id": "FAC001",
    },
    {
        "email": "superintendent@bits.ac.in",
        "password": "Super@123",
        "role": UserRole.HOSTEL_SUPERINTENDENT,
        "full_name": "Rajesh Kumar",
        "phone": "9000000004",
        "campus_id": "SUP001",
    },
    {
        "email": "confsup@bits.ac.in",
        "password": "ConSup@123",
        "role": UserRole.CONFERENCE_SUPERVISOR,
        "full_name": "Dr. Meena Pillai",
        "phone": "9000000005",
        "campus_id": "CON001",
    },
    {
        "email": "gate@bits.ac.in",
        "password": "Gate@123",
        "role": UserRole.GATE_SECURITY,
        "full_name": "Suresh Babu",
        "phone": "9000000006",
        "campus_id": "GATE001",
    },
]


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        created = []
        skipped = []

        for user_data in SEED_USERS:
            result = await session.execute(
                select(User).where(User.email == user_data["email"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                skipped.append(user_data["email"])
                continue

            user = User(
                email=user_data["email"],
                hashed_password=hash_password(user_data["password"]),
                role=user_data["role"],
                full_name=user_data["full_name"],
                phone=user_data["phone"],
                campus_id=user_data["campus_id"],
                is_active=True,
                created_at=datetime.now(timezone.utc),
            )
            session.add(user)
            await session.flush()

            # Create permanent pass for students and faculty
            if user.role in (UserRole.STUDENT, UserRole.FACULTY):
                perm_pass = Pass(
                    pass_type=PassType.PERMANENT_RESIDENT,
                    status=PassStatus.APPROVED,
                    applicant_id=user.id,
                    visitor_name=user.full_name,
                    visitor_phone=user.phone,
                    purpose="Permanent campus resident",
                    valid_from=date.today(),
                    valid_until=date.today() + timedelta(days=365),
                    approved_at=datetime.now(timezone.utc),
                    created_at=datetime.now(timezone.utc),
                )
                session.add(perm_pass)

            created.append(user_data["email"])

        await session.commit()

    await engine.dispose()

    print("\n" + "=" * 60)
    print("  BITS GATEPASS — SEED COMPLETE")
    print("=" * 60)

    if created:
        print(f"\n  Created {len(created)} user(s):\n")
        rows = [
            ("Role", "Email", "Password"),
            ("Super Admin", "admin@bits.ac.in", "Admin@123"),
            ("Student", "student@bits.ac.in", "Student@123"),
            ("Faculty", "faculty@bits.ac.in", "Faculty@123"),
            ("Hostel Superintendent", "superintendent@bits.ac.in", "Super@123"),
            ("Conference Supervisor", "confsup@bits.ac.in", "ConSup@123"),
            ("Gate Security", "gate@bits.ac.in", "Gate@123"),
        ]
        col_widths = [max(len(r[i]) for r in rows) + 2 for i in range(3)]
        for row in rows:
            line = "  " + "".join(cell.ljust(col_widths[i]) for i, cell in enumerate(row))
            print(line)

    if skipped:
        print(f"\n  Skipped (already exist): {', '.join(skipped)}")

    print("\n" + "=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(seed())
