from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator

from app.database import get_db
from app.models.user import User
from app.api.routes.auth import get_current_user_dep
from app.services.fretes import FretesService


# ── Response schemas ──────────────────────────────────────────────────────────

class FreteEntregadorSummary(BaseModel):
    entregador: str
    qtd_entregas: int
    valor_total: Decimal
    a_pagar: Decimal


class FretesSummaryResponse(BaseModel):
    total_entregas: int
    entregadores_ativos: int
    valor_total: Decimal
    a_pagar: Decimal
    por_entregador: List[FreteEntregadorSummary]


class FreteDetalheItem(BaseModel):
    id: UUID
    id_pedido: UUID
    numero_os: str
    nome_cliente: Optional[str] = None
    entregador: str
    data_frete: date
    valor: Decimal
    pago: bool


class FretesDetailResponse(BaseModel):
    items: List[FreteDetalheItem]


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/fretes", tags=["fretes"])

class FretePaymentRequest(BaseModel):
    entregador: str = Field(min_length=1)
    id_loja: Optional[UUID] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None

    @model_validator(mode="after")
    def valid_period(self):
        if self.data_inicio and self.data_fim and self.data_inicio > self.data_fim:
            raise ValueError("O início do período deve ser anterior ao fim.")
        return self


class FretePaymentResponse(BaseModel):
    confirmados: int


@router.patch("/pagamento", response_model=FretePaymentResponse)
def confirm_fretes_payment(
    payload: FretePaymentRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_dep),
):
    return FretesService.confirm_payment(db, **payload.model_dump())


@router.get("/summary", response_model=FretesSummaryResponse)
def get_fretes_summary(
    id_loja: Optional[UUID] = Query(default=None),
    data_inicio: Optional[date] = Query(default=None, description="YYYY-MM-DD"),
    data_fim: Optional[date] = Query(default=None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_dep),
):
    return FretesService.get_summary(
        db, id_loja=id_loja, data_inicio=data_inicio, data_fim=data_fim
    )


@router.get("/detail", response_model=FretesDetailResponse)
def get_fretes_detail(
    entregador: Optional[str] = Query(default=None),
    id_loja: Optional[UUID] = Query(default=None),
    data_inicio: Optional[date] = Query(default=None, description="YYYY-MM-DD"),
    data_fim: Optional[date] = Query(default=None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_dep),
):
    return FretesService.get_detail(
        db,
        entregador=entregador,
        id_loja=id_loja,
        data_inicio=data_inicio,
        data_fim=data_fim,
    )
