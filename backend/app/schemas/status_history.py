from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional
from app.models.status_history import EntityType


class StatusHistoryResponse(BaseModel):
    id: UUID
    entity_type: EntityType
    entity_id: UUID
    old_status: Optional[str] = None
    new_status: str
    changed_by: UUID
    changed_at: datetime
    reason: Optional[str] = None

    class Config:
        from_attributes = True
