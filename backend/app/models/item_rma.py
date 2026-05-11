import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ItemRmaStatus(str, enum.Enum):
    NOT_RECEIVED = "Not Received"
    RECEIVED = "Received"
    IN_REPAIR = "In Repair"
    REPAIRED = "Repaired"
    READY = "Ready"
    SHIPPED = "Shipped"
    DELIVERED = "Delivered"
    CANCELLED = "Cancelled"


class ItemRma(Base):
    __tablename__ = "item_rma"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_rma = Column(UUID(as_uuid=True), ForeignKey("rmas.id", ondelete="CASCADE"), nullable=False)
    id_produto_origem = Column(UUID(as_uuid=True), ForeignKey("produtos.id"), nullable=True)

    descricao = Column(Text, nullable=False)
    quantidade = Column(Integer, nullable=False)
    status = Column(SQLEnum(ItemRmaStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=ItemRmaStatus.NOT_RECEIVED)
    consertado_por = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("id_rma", "id_produto_origem", name="uq_item_rma_rma_produto"),
    )

    rma = relationship("Rma", back_populates="itens")

    def __repr__(self):
        return f"<ItemRma {self.id}>"
