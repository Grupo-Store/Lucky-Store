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
    receita: Decimal
    custo: Decimal
    lucro: Decimal
    margem: Decimal
    num_pedidos: int
    num_cancelamentos: int
    valor_cancelamentos: Decimal
    receita_hoje: Decimal
    ticket_venda: Decimal
    ticket_lucro: Decimal
    ticket_custo: Decimal
    imposto_compra: Decimal
    imposto_venda: Decimal
    outros_custos: Decimal


# ─── Breakdown ────────────────────────────────────────────────────────────────

class BreakdownItem(BaseModel):
    nome: str
    receita: Decimal
    custo: Decimal
    lucro: Decimal
    margem: Decimal
    num_pedidos: int


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
    target: Decimal
    floor: Optional[Decimal]

    model_config = {"from_attributes": True}


class GoalsListResponse(BaseModel):
    items: List[GoalResponse]


# ─── Projections ──────────────────────────────────────────────────────────────

class ProjectionsResponse(BaseModel):
    periodo_inicio: date
    periodo_fim: date
    dias_uteis_decorridos: int
    dias_uteis_restantes: int
    media_diaria: Decimal
    projecao_mes: Decimal
    meta_target: Optional[Decimal]
    meta_floor: Optional[Decimal]
    gap_target: Optional[Decimal]
    gap_floor: Optional[Decimal]
    meta_diaria_dinamica: Optional[Decimal]
    pct_meta: Optional[Decimal]
