import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, ForeignKey, Numeric, Date, DateTime, UniqueConstraint  # type: ignore[import]
from sqlalchemy.dialects.postgresql import UUID  # type: ignore[import]
from app.database import Base


class MetaVendedor(Base):
    """Monthly sales targets set per seller (piso, team target, individual target, withdrawal)."""
    __tablename__ = "meta_vendedor"

    # Chave primária
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Referência
    id_vendedor = Column(UUID(as_uuid=True), ForeignKey("vendedores.id"), nullable=False)

    # Período — armazenado como primeiro dia do mês (ex: 2026-04-01 representa abril/2026)
    ano_mes = Column(Date, nullable=False)

    # Metas
    piso = Column(Numeric(12, 2), nullable=True)
    alvo_equipe = Column(Numeric(12, 2), nullable=True)
    alvo_individual = Column(Numeric(12, 2), nullable=True)
    retirada_mes = Column(Numeric(12, 2), nullable=True)

    # Auditoria
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("id_vendedor", "ano_mes", name="uq_meta_vendedor_mes"),
    )

    def __repr__(self):
        return f"<MetaVendedor vendedor={self.id_vendedor} mes={self.ano_mes}>"
