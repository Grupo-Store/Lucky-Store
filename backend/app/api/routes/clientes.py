"""Rotas de clientes — usadas pelo autocomplete de CPF/CNPJ nos formulários."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.cliente import Cliente
from app.models.cotacao import Cotacao
from app.services.cliente import only_digits, find_cliente_by_documento

router = APIRouter(prefix="/clientes", tags=["clientes"])


class ClienteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nome: str
    empresa: Optional[str] = None
    cnpj: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None


class ClientesListResponse(BaseModel):
    items: list[ClienteOut]


@router.get("/lookup", response_model=Optional[ClienteOut])
def lookup_cliente(
    cnpj: str = Query(..., description="CPF ou CNPJ, com ou sem pontuação"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Busca um cliente pelo CPF/CNPJ, ignorando pontuação.

    Retorna `null` (200) quando não existe cliente com aquele documento — o
    front trata isso como "cliente novo", sem exibir erro.
    """
    digits = only_digits(cnpj)
    if len(digits) not in (11, 14):
        return None

    cliente = find_cliente_by_documento(db, digits)
    if cliente is None:
        return None

    # Retrocompatibilidade: clientes cadastrados antes da coluna `empresa`
    # existir não têm razão social. Nesse caso, tenta recuperar da cotação
    # mais recente com o mesmo documento.
    if not cliente.empresa:
        cliente.empresa = _empresa_from_cotacoes(db, digits)

    return cliente


def _empresa_from_cotacoes(db: Session, digits: str) -> Optional[str]:
    row = (
        db.query(Cotacao.b2b_company)
        .filter(
            func.regexp_replace(Cotacao.cnpj_cliente, r"[^0-9]", "", "g") == digits,
            Cotacao.b2b_company.isnot(None),
            Cotacao.b2b_company != "",
            Cotacao.deleted_at.is_(None),
        )
        .order_by(Cotacao.created_at.desc())
        .first()
    )
    return row[0] if row else None


@router.get("", response_model=ClientesListResponse)
def list_clientes(
    search: Optional[str] = Query(None, description="Filtra por nome, empresa ou CNPJ"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(Cliente).filter(Cliente.deleted_at.is_(None))

    if search:
        term = search.strip()
        digits = only_digits(term)
        conditions = [
            Cliente.nome.ilike(f"%{term}%"),
            Cliente.empresa.ilike(f"%{term}%"),
        ]
        if digits:
            conditions.append(
                func.regexp_replace(Cliente.cnpj, r"[^0-9]", "", "g").like(f"%{digits}%")
            )
        from sqlalchemy import or_
        query = query.filter(or_(*conditions))

    return {"items": query.order_by(Cliente.nome).limit(limit).all()}
