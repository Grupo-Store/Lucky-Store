import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, ForeignKey, Numeric, DateTime, UniqueConstraint  # type: ignore[import]
from sqlalchemy.dialects.postgresql import UUID  # type: ignore[import]
from app.database import Base


class VendaVendedor(Base):
    """Links a sale (pedido) to the seller responsible, recording sale value and profit."""
    __tablename__ = "venda_vendedor"

    # Chave primária
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Referências
    id_pedido = Column(UUID(as_uuid=True), ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False)
    id_vendedor = Column(UUID(as_uuid=True), ForeignKey("vendedores.id"), nullable=False)

    # Financeiro
    valor_venda = Column(Numeric(12, 2), nullable=True)
    lucro = Column(Numeric(12, 2), nullable=True)

    # Auditoria
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("id_pedido", "id_vendedor", name="uq_venda_vendedor"),
    )

    def __repr__(self):
        return f"<VendaVendedor pedido={self.id_pedido} vendedor={self.id_vendedor}>"
