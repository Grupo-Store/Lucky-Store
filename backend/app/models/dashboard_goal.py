import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Numeric, String, DateTime, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class DashboardGoal(Base):
    __tablename__ = "dashboard_goals"
    __table_args__ = (
        UniqueConstraint("ano", "mes", "id_loja", "tipo", name="uq_dashboard_goal_ano_mes_loja_tipo"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ano = Column(Integer, nullable=False)
    mes = Column(Integer, nullable=False)
    id_loja = Column(UUID(as_uuid=True), ForeignKey("lojas.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(15), nullable=False, server_default="faturamento")
    target = Column(Numeric(14, 2), nullable=False)
    floor = Column(Numeric(14, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
