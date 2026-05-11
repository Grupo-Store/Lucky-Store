from pydantic import BaseModel, field_validator
from datetime import date, datetime
from uuid import UUID
from typing import Optional, List
from app.models.item_rma import ItemRmaStatus
from app.models.rma import RmaStatus


class ItemRmaCreate(BaseModel):
    id_produto_origem: Optional[UUID] = None
    descricao: str
    quantidade: int

    @field_validator("quantidade")
    @classmethod
    def validate_quantidade(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Quantidade deve ser maior que 0")
        return v


class ItemRmaStatusUpdate(BaseModel):
    new_status: ItemRmaStatus
    consertado_por: Optional[str] = None


class ItemRmaResponse(BaseModel):
    id: UUID
    id_rma: UUID
    id_produto_origem: Optional[UUID] = None
    descricao: str
    quantidade: int
    status: ItemRmaStatus
    consertado_por: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RmaCreate(BaseModel):
    id_pedido_origem: UUID
    numero_rma: Optional[str] = None
    prazo_entrega: Optional[date] = None
    itens: List[ItemRmaCreate]

    @field_validator("itens")
    @classmethod
    def validate_itens(cls, v: list) -> list:
        if not v:
            raise ValueError("RMA deve ter pelo menos um item")
        return v


class RmaResponse(BaseModel):
    id: UUID
    id_pedido_origem: UUID
    id_vendedor: UUID
    id_loja: UUID
    numero_rma: str
    data_registro: date
    prazo_entrega: Optional[date]
    status: RmaStatus
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    itens: List[ItemRmaResponse] = []

    class Config:
        from_attributes = True


class RmaListResponse(BaseModel):
    items: List[RmaResponse]
    total: int
    page: int
    limit: int
    pages: int
