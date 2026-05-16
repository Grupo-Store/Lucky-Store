import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import Numeric
from sqlalchemy.orm import relationship
from app.database import Base


class ItemCotacao(Base):
    __tablename__ = "item_cotacao"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_cotacao = Column(UUID(as_uuid=True), ForeignKey("cotacoes.id", ondelete="CASCADE"), nullable=False)

    descricao = Column(Text, nullable=False)
    quantidade = Column(Integer, nullable=False)

    valor_unitario = Column(Numeric(12, 2), nullable=False)
    # valor_total é coluna gerada no DB (quantidade * valor_unitario) — não mapeada aqui

    valor_fechamento = Column(Numeric(12, 2), nullable=True)
    # valor_total_fechamento é coluna gerada no DB (quantidade * valor_fechamento) — não mapeada aqui

    fornecedor = Column(Text, nullable=True)
    is_direct_supply = Column(Boolean, nullable=False, default=False)
    porcentagem_fornecedor = Column(Numeric(5, 2), nullable=True)
    frete_fornecedor = Column(Numeric(12, 2), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    cotacao = relationship("Cotacao", back_populates="itens")

    def __repr__(self):
        return f"<ItemCotacao {self.descricao} x{self.quantidade}>"
