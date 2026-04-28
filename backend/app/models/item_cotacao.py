import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, Numeric, Computed
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ItemCotacao(Base):
    __tablename__ = "item_cotacao"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_cotacao = Column(UUID(as_uuid=True), ForeignKey("cotacoes.id", ondelete="CASCADE"), nullable=False)

    descricao = Column(Text, nullable=False)
    quantidade = Column(Integer, nullable=False)
    valor_unitario = Column(Numeric(12, 2), nullable=False)
    valor_total = Column(Numeric(12, 2), Computed("quantidade * valor_unitario", persisted=True), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    cotacao = relationship("Cotacao", back_populates="itens")

    def __repr__(self):
        return f"<ItemCotacao {self.id}>"
