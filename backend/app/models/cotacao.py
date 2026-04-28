import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Date, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Cotacao(Base):
    __tablename__ = "cotacoes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_loja = Column(UUID(as_uuid=True), ForeignKey("lojas.id"), nullable=False)
    id_vendedor = Column(UUID(as_uuid=True), ForeignKey("vendedores.id"), nullable=False)

    numero_requisicao = Column(String(50), nullable=True)
    cliente = Column(String(255), nullable=False)
    cnpj_cliente = Column(String(20), nullable=True)

    data_cotacao = Column(Date, nullable=False)
    data_validade = Column(Date, nullable=True)

    status_enviada = Column(Boolean, default=False)
    data_envio = Column(Date, nullable=True)
    status_em_fechamento = Column(Boolean, default=False)
    status_fechada = Column(Boolean, default=False)
    data_fechamento = Column(Date, nullable=True)
    status_caida = Column(Boolean, default=False)
    data_queda = Column(Date, nullable=True)

    is_direct_billing = Column(Boolean, default=False)
    fornecedor = Column(String(255), nullable=True)
    valor_total = Column(Numeric(12, 2), nullable=True)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("id_loja", "id_vendedor", "data_cotacao", "numero_requisicao", name="uq_cotacao"),
    )

    loja = relationship("Loja", back_populates="cotacoes")
    vendedor = relationship("Vendedor", back_populates="cotacoes", foreign_keys=[id_vendedor])
    itens = relationship("ItemCotacao", back_populates="cotacao", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Cotacao {self.numero_requisicao or self.id}>"
