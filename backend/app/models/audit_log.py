import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, ForeignKey, String, Text, DateTime, Enum as SQLEnum  # type: ignore[import]
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET  # type: ignore[import]
from app.database import Base


class AuditAction(str, enum.Enum):
    """CRUD-style actions recorded in the audit log."""
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    RESTORE = "RESTORE"


class AuditLog(Base):
    """Full audit trail with before/after JSONB snapshots for every data change."""
    __tablename__ = "audit_logs"

    # Chave primária
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Referência da entidade — string livre, qualquer tabela pode ser auditada
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)

    # Ação
    action = Column(SQLEnum(AuditAction), nullable=False)

    # Auditoria
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Snapshots do registro — NULL em CREATE (sem old) / DELETE (sem new)
    old_values = Column(JSONB, nullable=True)
    new_values = Column(JSONB, nullable=True)

    # Contexto da requisição para rastreabilidade forense
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)

    def __repr__(self):
        return f"<AuditLog {self.action} {self.entity_type}={self.entity_id}>"
