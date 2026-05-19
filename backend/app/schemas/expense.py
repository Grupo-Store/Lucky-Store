from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional


class ExpenseCreate(BaseModel):
    descricao: str
    valor: Decimal
    data_prevista: date
    data_paga: Optional[date] = None
    recorrente: bool = False
    id_loja: UUID
    parcelas: Optional[int] = None


class ExpenseUpdate(BaseModel):
    descricao: Optional[str] = None
    valor: Optional[Decimal] = None
    data_paga: Optional[date] = None


class ExpenseResponse(BaseModel):
    id: UUID
    id_loja: UUID
    descricao: str
    valor: Decimal
    data_prevista: date
    data_paga: Optional[date] = None
    recorrente: bool
    parcelas: Optional[int] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExpenseListResponse(BaseModel):
    items: list[ExpenseResponse]
    total: int
    page: int
    limit: int
