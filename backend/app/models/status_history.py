import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, ForeignKey, String, Text, DateTime, Enum as SQLEnum  # type: ignore[import]
from sqlalchemy.dialects.postgresql import UUID  # type: ignore[import]
from app.database import Base


class EntityType(str, enum.Enum):
    """Entity types that can have their status tracked."""
    PEDIDO = "pedido"
    PRODUTO = "produto"
    RMA = "rma"
    ITEM_RMA = "item_rma"
    COTACAO = "cotacao"


class StatusHistory(Base):
    """Immutable audit trail for every status transition on any trackable entity."""
    __tablename__ = "status_history"

    # Chave primária
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Referência da entidade — sem FK; entity_type + entity_id identificam o registro
    entity_type = Column(SQLEnum(EntityType, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)

    # Transição de status
    old_status = Column(String(50), nullable=True)   # NULL na primeira atribuição de status
    new_status = Column(String(50), nullable=False)

    # Auditoria
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    reason = Column(Text, nullable=True)

    def __repr__(self):
        return f"<StatusHistory {self.entity_type}={self.entity_id} '{self.old_status}'->'{self.new_status}'>"
