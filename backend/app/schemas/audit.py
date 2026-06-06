from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    actor_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    metadata_json: Optional[str] = None
    timestamp: datetime
    actor_name: Optional[str] = None

    model_config = {"from_attributes": True}


class AuditLogFilters(BaseModel):
    action: Optional[str] = None
    entity_type: Optional[str] = None
    actor_id: Optional[int] = None
    limit: int = 100
    offset: int = 0
