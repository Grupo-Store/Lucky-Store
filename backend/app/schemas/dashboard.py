from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, field_validator


# ─── Filters ──────────────────────────────────────────────────────────────────

class DashboardFilters(BaseModel):
    mes: Optional[int] = None
    ano: Optional[int] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    id_loja: Optional[UUID] = None


# ─── KPIs ─────────────────────────────────────────────────────────────────────

class DashboardKpisResponse(BaseModel):
    periodo_inicio: date
    periodo_fim: date
    receita: float
    custo: float
    lucro: float
    margem: float
    num_pedidos: int
    num_cancelamentos: int
    valor_cancelamentos: float
    receita_hoje: float
    ticket_venda: float
    ticket_lucro: float
    ticket_custo: float
    imposto_compra: float
    imposto_venda: float
    outros_custos: float
    custo_frete: float


# ─── Breakdown ────────────────────────────────────────────────────────────────

class BreakdownItem(BaseModel):
    nome: str
    receita: float
    custo: float
    lucro: float
    margem: float
    num_pedidos: int
    num_cancelamentos: int
    valor_cancelamentos: float
    ticket_venda: float
    ticket_custo: float
    ticket_lucro: float


class BreakdownByCompanyResponse(BaseModel):
    items: List[BreakdownItem]


class BreakdownBySellerItem(BreakdownItem):
    id_vendedor: UUID


class BreakdownBySellerResponse(BaseModel):
    items: List[BreakdownBySellerItem]


# ─── Goals ────────────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    ano: int
    mes: int
    id_loja: UUID
    target: Decimal
    floor: Optional[Decimal] = None

    @field_validator("mes")
    @classmethod
    def validate_mes(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("mes deve estar entre 1 e 12")
        return v

    @field_validator("ano")
    @classmethod
    def validate_ano(cls, v: int) -> int:
        if not 2020 <= v <= 2100:
            raise ValueError("ano inválido")
        return v


class GoalResponse(BaseModel):
    id: UUID
    ano: int
    mes: int
    id_loja: UUID
    nome_loja: Optional[str] = None
    target: float
    floor: Optional[float]

    model_config = {"from_attributes": True}


class GoalsListResponse(BaseModel):
    items: List[GoalResponse]


# ─── Vendor Goals ─────────────────────────────────────────────────────────────

class VendorGoalCreate(BaseModel):
    ano: int
    mes: int
    id_vendedor: UUID
    target: Decimal
    floor: Optional[Decimal] = None

    @field_validator("mes")
    @classmethod
    def validate_mes(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("mes deve estar entre 1 e 12")
        return v

    @field_validator("ano")
    @classmethod
    def validate_ano(cls, v: int) -> int:
        if not 2020 <= v <= 2100:
            raise ValueError("ano inválido")
        return v


class VendorGoalResponse(BaseModel):
    id: UUID
    ano: int
    mes: int
    id_vendedor: UUID
    nome_vendedor: Optional[str] = None
    target: float
    floor: Optional[float]

    model_config = {"from_attributes": True}


class VendorGoalsListResponse(BaseModel):
    items: List[VendorGoalResponse]


# ─── Daily Series ─────────────────────────────────────────────────────────────

class DailySeriesItem(BaseModel):
    data: str
    faturamento: float
    lucro: float
    ano_anterior: float
    custo: float = 0
    gastos_fixos: float = 0
    ganhos_financeiros: float = 0
    fretes: float = 0


class DailySeriesResponse(BaseModel):
    items: List[DailySeriesItem]


# ─── Projections ──────────────────────────────────────────────────────────────

class ProjectionsResponse(BaseModel):
    periodo_inicio: date
    periodo_fim: date
    dias_uteis_decorridos: int
    dias_uteis_restantes: int
    media_diaria: float
    projecao_mes: float
    meta_target: Optional[float]
    meta_floor: Optional[float]
    gap_target: Optional[float]
    gap_floor: Optional[float]
    meta_diaria_dinamica: Optional[float]
    pct_meta: Optional[float]


# ─── Card spend ───────────────────────────────────────────────────────────────

class CardSpendItem(BaseModel):
    card: str
    total: float


class CardSpendResponse(BaseModel):
    items: List[CardSpendItem]
