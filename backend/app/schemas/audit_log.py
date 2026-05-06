from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional, Any
from app.models.audit_log import AuditAction


class AuditLogResponse(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    action: AuditAction
    changed_by: UUID
    changed_at: datetime
    old_values: Optional[Any] = None
    new_values: Optional[Any] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    class Config:
        from_attributes = True
