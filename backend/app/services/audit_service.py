import json
from typing import Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.audit import AuditLog


async def log_action(
    db: AsyncSession,
    action: str,
    entity_type: str,
    *,
    actor_id: Optional[int] = None,
    entity_id: Optional[int] = None,
    metadata: Optional[dict] = None,
) -> AuditLog:
    """Persist an audit log entry. All significant system events should call this."""
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(entry)
    await db.flush()
    return entry


async def get_audit_logs(
    db: AsyncSession,
    *,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    actor_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditLog]:
    """Fetch filtered audit log entries for admin review."""
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if actor_id:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())
