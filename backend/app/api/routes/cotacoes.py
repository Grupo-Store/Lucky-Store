from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.schemas.cotacao import (
    CotacaoCreate, CotacaoUpdate, CotacaoResponse,
    CotacaoListResponse, PhaseUpdate,
)
from app.services.cotacao import CotacaoService
from app.utils.errors import NotFoundException, BusinessLogicException, to_http_exception
from app.api.routes.auth import get_current_user_dep

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.post("", response_model=CotacaoResponse, status_code=status.HTTP_201_CREATED)
def create_quote(
    data: CotacaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return CotacaoService.create(db, data, current_user.id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("", response_model=CotacaoListResponse)
def list_quotes(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    id_loja: Optional[UUID] = Query(default=None),
    id_vendedor: Optional[UUID] = Query(default=None),
    cliente: Optional[str] = Query(default=None, description="Busca parcial por nome"),
    data_inicio: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    data_fim: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    sort_by: str = Query(default="data_cotacao"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    eligible_for_order: Optional[bool] = Query(default=None, description="Se true, retorna apenas cotações fechadas ou caídas"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_dep),
):
    items, total, pages = CotacaoService.list(
        db, page=page, limit=limit,
        id_loja=id_loja, id_vendedor=id_vendedor, cliente=cliente,
        data_inicio=data_inicio, data_fim=data_fim,
        sort_by=sort_by, sort_dir=sort_dir,
        eligible_for_order=eligible_for_order,
    )
    return CotacaoListResponse(items=items, total=total, page=page, limit=limit, pages=pages)


@router.get("/{quote_id}", response_model=CotacaoResponse)
def get_quote(
    quote_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_dep),
):
    try:
        return CotacaoService.get_by_id(db, quote_id)
    except NotFoundException as exc:
        raise to_http_exception(exc)


@router.put("/{quote_id}", response_model=CotacaoResponse)
def update_quote(
    quote_id: UUID,
    data: CotacaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return CotacaoService.update(db, quote_id, data, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch("/{quote_id}/phase", response_model=CotacaoResponse)
def update_phase(
    quote_id: UUID,
    data: PhaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return CotacaoService.update_phase(db, quote_id, data, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except BusinessLogicException as exc:
        raise to_http_exception(exc)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(
    quote_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        CotacaoService.soft_delete(db, quote_id, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
