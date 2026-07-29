import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, Date, ForeignKey, UniqueConstraint, Enum as SQLEnum, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ItemRmaStatus(str, enum.Enum):
    NOT_RECEIVED = "Not Received"
    RECEIVED = "Received"
    SENT_FOR_REPAIR = "Sent for Repair"
    IN_REPAIR = "In Repair"
    REPAIRED_NOT_RECEIVED = "Repaired Not Received"
    REPAIRED_RECEIVED = "Repaired Received"
    TO_PACK = "To Pack"
    READY_FOR_DELIVERY = "Ready for Delivery"
    OUT_FOR_DELIVERY = "Out for Delivery"
    DELIVERED = "Delivered"
    ESTORNO = "Estorno"


class ItemRma(Base):
    __tablename__ = "item_rma"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_rma = Column(UUID(as_uuid=True), ForeignKey("rmas.id", ondelete="CASCADE"), nullable=False)
    id_produto_origem = Column(UUID(as_uuid=True), ForeignKey("produtos.id"), nullable=True)

    descricao = Column(Text, nullable=False)
    quantidade = Column(Integer, nullable=False)
    status = Column(SQLEnum(ItemRmaStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=ItemRmaStatus.NOT_RECEIVED)
    consertado_por = Column(String(255), nullable=True)
    fornecedor = Column(String(255), nullable=True)
    valor_estornado = Column(Numeric(12, 2), nullable=True)
    data_estorno = Column(Date, nullable=True)
    motivo_estorno = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("id_rma", "id_produto_origem", name="uq_item_rma_rma_produto"),
    )

    rma = relationship("Rma", back_populates="itens")

    def __repr__(self):
        return f"<ItemRma {self.id}>"
