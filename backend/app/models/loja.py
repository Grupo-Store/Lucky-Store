import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime  # type: ignore[import]
from sqlalchemy.dialects.postgresql import UUID  # type: ignore[import]
from sqlalchemy.orm import relationship
from app.database import Base


class Loja(Base):
    __tablename__ = "lojas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(100), unique=True, nullable=False)
    cnpj = Column(String(20), unique=True, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(2), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    vendedores = relationship("Vendedor", back_populates="loja", lazy="select")
    pedidos = relationship("Pedido", back_populates="loja", lazy="select")
    rmas = relationship("Rma", back_populates="loja", lazy="select")
    cotacoes = relationship("Cotacao", back_populates="loja", lazy="select")

    def __repr__(self):
        return f"<Loja {self.nome}>"
