import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Vendedor(Base):
    __tablename__ = "vendedores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_loja = Column(UUID(as_uuid=True), ForeignKey("lojas.id", ondelete="RESTRICT"), nullable=False)
    nome = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("id_loja", "nome", name="uq_vendedor_loja_nome"),
    )

    # Many-to-one: vendedor pertence a uma loja
    loja = relationship("Loja", back_populates="vendedores")

    # One-to-many: vendedor pode ter vários pedidos, RMAs, cotações
    pedidos = relationship("Pedido", back_populates="vendedor", foreign_keys="Pedido.id_vendedor")
    rmas = relationship("Rma", back_populates="vendedor", foreign_keys="Rma.id_vendedor")
    cotacoes = relationship("Cotacao", back_populates="vendedor", foreign_keys="Cotacao.id_vendedor")

    # Registros de comissão/participação
    vendas = relationship("VendaVendedor", back_populates="vendedor", cascade="all, delete-orphan")
    compras = relationship("CompraVendedor", back_populates="vendedor", cascade="all, delete-orphan")
    metas = relationship("MetaVendedor", back_populates="vendedor", cascade="all, delete-orphan")

    # Produtos onde este vendedor é o vendedor ou o comprador
    produtos_vendidos = relationship(
        "Produto",
        back_populates="vendedor",
        foreign_keys="Produto.id_vendedor",
    )
    produtos_comprados = relationship(
        "Produto",
        back_populates="comprador",
        foreign_keys="Produto.id_comprador",
    )

    def __repr__(self):
        return f"<Vendedor {self.nome}>"
