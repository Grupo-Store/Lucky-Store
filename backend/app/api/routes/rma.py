from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from datetime import date
from app.database import get_db
from app.models.user import User
from app.models.rma import RmaStatus
from app.schemas.rma import (
    RmaCreate, RmaUpdate, RmaResponse, RmaListResponse,
    ItemRmaStatusUpdate, ItemRmaResponse,
)
from app.services.rma import RmaService
from app.utils.errors import NotFoundException, BusinessLogicException, to_http_exception
from app.api.routes.auth import get_current_user_dep

router = APIRouter(prefix="/rma", tags=["rma"])


@router.post("", response_model=RmaResponse, status_code=status.HTTP_201_CREATED)
def create_rma(
    data: RmaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return RmaService.create(db, data, current_user.id)
    except (NotFoundException, BusinessLogicException) as exc:
        raise to_http_exception(exc)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("", response_model=RmaListResponse)
def list_rmas(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=500),
    status_filter: Optional[RmaStatus] = Query(default=None, alias="status"),
    id_loja: Optional[UUID] = Query(default=None),
    id_vendedor: Optional[UUID] = Query(default=None),
    id_pedido_origem: Optional[UUID] = Query(default=None),
    data_inicio: Optional[date] = Query(default=None),
    data_fim: Optional[date] = Query(default=None),
    sort_by: str = Query(default="data_registro"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_dep),
):
    items, total, pages = RmaService.list(
        db, page=page, limit=limit,
        status=status_filter,
        id_loja=id_loja, id_vendedor=id_vendedor, id_pedido_origem=id_pedido_origem,
        data_inicio=data_inicio, data_fim=data_fim,
        sort_by=sort_by, sort_dir=sort_dir,
    )
    return RmaListResponse(items=items, total=total, page=page, limit=limit, pages=pages)


@router.patch("/{rma_id}", response_model=RmaResponse)
def update_rma(
    rma_id: UUID,
    data: RmaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return RmaService.update(db, rma_id, data, current_user.id)
    except (NotFoundException, BusinessLogicException) as exc:
        raise to_http_exception(exc)


@router.get("/{rma_id}", response_model=RmaResponse)
def get_rma(
    rma_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_dep),
):
    try:
        return RmaService.get_by_id(db, rma_id)
    except NotFoundException as exc:
        raise to_http_exception(exc)


@router.patch("/{rma_id}/close", response_model=RmaResponse)
def close_rma(
    rma_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return RmaService.close(db, rma_id, current_user.id)
    except (NotFoundException, BusinessLogicException) as exc:
        raise to_http_exception(exc)


@router.patch("/{rma_id}/items/{item_id}/status", response_model=ItemRmaResponse)
def update_item_status(
    rma_id: UUID,
    item_id: UUID,
    data: ItemRmaStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return RmaService.update_item_status(db, rma_id, item_id, data, current_user.id)
    except (NotFoundException, BusinessLogicException) as exc:
        raise to_http_exception(exc)
