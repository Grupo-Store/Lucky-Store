from pydantic import BaseModel, field_validator, Field
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional
from app.models.produto import PRODUTO_STATUSES


class ProdutoCreate(BaseModel):
    id_vendedor: UUID
    id_comprador: Optional[UUID] = None
    descricao: str
    quantidade: int = Field(gt=0)
    valor_projetado: Decimal = Field(gt=0)
    valor_compra: Optional[Decimal] = None
    fornecedor: Optional[str] = None
    data_compra: Optional[date] = None
    prazo_entrega: Optional[date] = None
    data_recebimento: Optional[date] = None


class ProdutoStatusUpdate(BaseModel):
    new_status: str

    @field_validator("new_status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in PRODUTO_STATUSES:
            raise ValueError(f"Status inválido. Valores aceitos: {PRODUTO_STATUSES}")
        return v


class ProdutoResponse(BaseModel):
    id: UUID
    id_pedido: UUID
    id_vendedor: UUID
    id_comprador: Optional[UUID]
    descricao: str
    quantidade: int
    valor_projetado: Decimal
    valor_compra: Optional[Decimal]
    economia: Optional[Decimal]
    fornecedor: Optional[str]
    data_compra: Optional[date]
    prazo_entrega: Optional[date]
    data_recebimento: Optional[date]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
