import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, ForeignKey, Numeric, DateTime, UniqueConstraint  # type: ignore[import]
from sqlalchemy.dialects.postgresql import UUID  # type: ignore[import]
from app.database import Base


class CompraVendedor(Base):
    """Links a purchase (produto) to the seller who bought it, recording purchase value and profit."""
    __tablename__ = "compra_vendedor"

    # Chave primária
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Referências
    id_produto = Column(UUID(as_uuid=True), ForeignKey("produtos.id", ondelete="CASCADE"), nullable=False)
    id_vendedor = Column(UUID(as_uuid=True), ForeignKey("vendedores.id"), nullable=False)

    # Financeiro
    valor_compra = Column(Numeric(12, 2), nullable=True)
    lucro = Column(Numeric(12, 2), nullable=True)

    # Auditoria
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("id_produto", "id_vendedor", name="uq_compra_vendedor"),
    )

    def __repr__(self):
        return f"<CompraVendedor produto={self.id_produto} vendedor={self.id_vendedor}>"
