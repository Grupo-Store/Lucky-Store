import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, Date, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_loja = Column(UUID(as_uuid=True), ForeignKey("lojas.id"), nullable=False)
    descricao = Column(String(255), nullable=False)
    valor = Column(Numeric(12, 2), nullable=False)
    data_prevista = Column(Date, nullable=False)
    data_paga = Column(Date, nullable=True)
    recorrente = Column(Boolean, default=False)
    parcelas = Column(Integer, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    loja = relationship("Loja", backref="expenses")

    def __repr__(self):
        return f"<Expense {self.descricao} valor={self.valor}>"
