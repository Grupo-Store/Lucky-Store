import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class RmaStatus(str, enum.Enum):
    REGISTERED = "Registered"
    IN_ANALYSIS = "In Analysis"
    APPROVED = "Approved"
    IN_REPAIR = "In Repair"
    REPAIRED = "Repaired"
    READY = "Ready"
    SHIPPED = "Shipped"
    DELIVERED = "Delivered"
    CANCELLED = "Cancelled"
    COMPLETED = "Completed"


class Rma(Base):
    __tablename__ = "rmas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_pedido_origem = Column(UUID(as_uuid=True), ForeignKey("pedidos.id"), nullable=False)
    id_vendedor = Column(UUID(as_uuid=True), ForeignKey("vendedores.id"), nullable=False)
    id_loja = Column(UUID(as_uuid=True), ForeignKey("lojas.id"), nullable=False)

    numero_rma = Column(String(50), unique=True, nullable=False)
    data_registro = Column(Date, nullable=False)
    prazo_entrega = Column(Date, nullable=True)

    status = Column(SQLEnum(RmaStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=RmaStatus.REGISTERED)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    loja = relationship("Loja", back_populates="rmas")
    vendedor = relationship("Vendedor", back_populates="rmas", foreign_keys=[id_vendedor])
    itens = relationship("ItemRma", back_populates="rma", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Rma {self.numero_rma}>"
