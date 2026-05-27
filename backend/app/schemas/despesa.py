from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional, List


class PlanoParcelaItem(BaseModel):
    date: str
    value: Decimal


class DespesaCreate(BaseModel):
    tipo: str                              # 'PREVISAO' | 'PAGO'
    servico: str
    destino: str = ''
    valor_previsto: Optional[Decimal] = None
    data_prevista: Optional[date] = None
    status: Optional[str] = None          # 'Não Pago' | 'Pago'
    valor_pago: Optional[Decimal] = None
    data_pagamento: Optional[date] = None
    metodo_pagamento: Optional[str] = None
    parcelas: Optional[int] = None
    plano_parcelas: Optional[List[PlanoParcelaItem]] = None
    observacoes: Optional[str] = None


class DespesaUpdate(BaseModel):
    tipo: Optional[str] = None
    servico: Optional[str] = None
    destino: Optional[str] = None
    valor_previsto: Optional[Decimal] = None
    data_prevista: Optional[date] = None
    status: Optional[str] = None
    valor_pago: Optional[Decimal] = None
    data_pagamento: Optional[date] = None
    metodo_pagamento: Optional[str] = None
    parcelas: Optional[int] = None
    plano_parcelas: Optional[List[PlanoParcelaItem]] = None
    observacoes: Optional[str] = None


class DespesaOut(BaseModel):
    id: UUID
    tipo: str
    servico: str
    destino: str
    valor_previsto: Optional[Decimal] = None
    data_prevista: Optional[date] = None
    status: Optional[str] = None
    valor_pago: Optional[Decimal] = None
    data_pagamento: Optional[date] = None
    metodo_pagamento: Optional[str] = None
    parcelas: Optional[int] = None
    plano_parcelas: Optional[List[PlanoParcelaItem]] = None
    observacoes: Optional[str] = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
