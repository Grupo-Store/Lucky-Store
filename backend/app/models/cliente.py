import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime  # type: ignore[import]
from sqlalchemy.dialects.postgresql import UUID  # type: ignore[import]
from sqlalchemy.orm import relationship
from app.database import Base


class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(255), nullable=False)
    # Sem UNIQUE de proposito. A regra de identidade de cliente e
    # (mesmo nome E mesmo documento) - ver app/services/cliente_identidade.py.
    # Com UNIQUE, "mesmo documento com nome diferente" nao conseguiria virar um
    # segundo cliente: o INSERT estourava com duplicate key e o vendedor tomava
    # um 500 ao criar o pedido. O index fica para a busca continuar barata.
    cnpj = Column(String(20), index=True, nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(2), nullable=True)
    zip_code = Column(String(10), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    pedidos = relationship("Pedido", back_populates="cliente")

    def __repr__(self):
        return f"<Cliente {self.nome}>"
