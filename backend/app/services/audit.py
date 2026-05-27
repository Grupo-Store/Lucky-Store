from sqlalchemy.orm import Session
from sqlalchemy import inspect as sa_inspect
from app.models.audit_log import AuditLog, AuditAction
from app.models.status_history import StatusHistory, EntityType


class AuditService:

    @staticmethod
    def snapshot(instance) -> dict:
        """Serialize a SQLAlchemy model instance to a JSON-safe dict for JSONB storage."""
        result = {}
        for attr in sa_inspect(instance.__class__).mapper.column_attrs:
            val = getattr(instance, attr.key)
            if val is None:
                result[attr.key] = None
            elif hasattr(val, "isoformat"):
                result[attr.key] = val.isoformat()
            elif hasattr(val, "hex"):  # UUID
                result[attr.key] = str(val)
            else:
                result[attr.key] = val
        return result

    @staticmethod
    def extract_request_context(request) -> tuple[str | None, str | None]:
        """Return (ip_address, user_agent) from a FastAPI Request object."""
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")
        return ip, ua

    @staticmethod
    def log_create(
        db: Session,
        entity_type: str,
        entity_id,
        new_values: dict,
        changed_by_id,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        db.add(AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=AuditAction.CREATE,
            changed_by=changed_by_id,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        ))

    @staticmethod
    def log_update(
        db: Session,
        entity_type: str,
        entity_id,
        old_values: dict,
        new_values: dict,
        changed_by_id,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        db.add(AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=AuditAction.UPDATE,
            changed_by=changed_by_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        ))

    @staticmethod
    def log_delete(
        db: Session,
        entity_type: str,
        entity_id,
        old_values: dict,
        changed_by_id,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        db.add(AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=AuditAction.DELETE,
            changed_by=changed_by_id,
            old_values=old_values,
            ip_address=ip_address,
            user_agent=user_agent,
        ))

    @staticmethod
    def log_status_change(
        db: Session,
        entity_type: EntityType,
        entity_id,
        old_status: str | None,
        new_status: str,
        changed_by_id,
        reason: str | None = None,
    ) -> None:
        db.add(StatusHistory(
            entity_type=entity_type,
            entity_id=entity_id,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by_id,
            reason=reason,
        ))
