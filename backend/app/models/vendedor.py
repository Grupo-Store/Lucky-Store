import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint  # type: ignore[import]
from sqlalchemy.dialects.postgresql import UUID  # type: ignore[import]
from sqlalchemy.orm import relationship
from app.database import Base


class Vendedor(Base):
    __tablename__ = "vendedores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_loja = Column(UUID(as_uuid=True), ForeignKey("lojas.id", ondelete="RESTRICT"), nullable=False)
    nome = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("id_loja", "nome", name="uq_vendedor_loja_nome"),
    )

    loja = relationship("Loja", back_populates="vendedores")

    pedidos = relationship("Pedido", back_populates="vendedor", foreign_keys="Pedido.id_vendedor")
    rmas = relationship("Rma", back_populates="vendedor", foreign_keys="Rma.id_vendedor")
    cotacoes = relationship("Cotacao", back_populates="vendedor", foreign_keys="Cotacao.id_vendedor")

    vendas = relationship("VendaVendedor", back_populates="vendedor", cascade="all, delete-orphan")
    compras = relationship("CompraVendedor", back_populates="vendedor", cascade="all, delete-orphan")
    metas = relationship("MetaVendedor", back_populates="vendedor", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Vendedor {self.nome}>"
