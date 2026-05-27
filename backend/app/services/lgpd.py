from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.audit_log import AuditLog, AuditAction


def _anonymize_email(user_id: UUID) -> str:
    return f"deleted_{str(user_id)[:8]}@anonimizado.invalid"


class LgpdService:

    @staticmethod
    def delete_user_data(db: Session, user_id: UUID, requesting_user_id: UUID) -> dict:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"deleted": False, "reason": "User not found"}

        original_email = user.email
        original_name = user.name

        user.email = _anonymize_email(user_id)
        user.name = "Usuário Removido"
        user.password_hash = ""
        user.totp_secret = None
        user.totp_enabled = False
        user.is_active = False
        user.deleted_at = datetime.now(timezone.utc)

        db.add(AuditLog(
            entity_type="user",
            entity_id=user_id,
            action=AuditAction.DELETE,
            changed_by=requesting_user_id,
            old_values={"email": original_email, "name": original_name},
            new_values={"email": user.email, "name": user.name, "reason": "LGPD deletion request"},
        ))

        db.commit()
        return {"deleted": True, "user_id": str(user_id)}
