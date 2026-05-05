from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from app.database import get_db
from app.models.user import User
from app.schemas.pedido import (
    PedidoCreate, PedidoUpdate, PedidoResponse,
    PedidoDetailResponse, PedidoListResponse, StatusChangeRequest,
    StatusHistoryOut,
)
from app.services.pedido import PedidoService
from app.utils.errors import NotFoundException, BusinessLogicException, to_http_exception
from app.api.routes.auth import get_current_user_dep

router = APIRouter(prefix="/pedidos", tags=["pedidos"])


@router.post("", response_model=PedidoResponse, status_code=status.HTTP_201_CREATED)
def create_pedido(
    data: PedidoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return PedidoService.create(db, data, current_user.id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("", response_model=PedidoListResponse)
def list_pedidos(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    id_loja: Optional[UUID] = Query(default=None),
    id_vendedor: Optional[UUID] = Query(default=None),
    data_inicio: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    data_fim: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    sort_by: str = Query(default="data_pedido"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_dep),
):
    items, total, pages = PedidoService.list(
        db, page=page, limit=limit,
        status=status_filter, id_loja=id_loja, id_vendedor=id_vendedor,
        data_inicio=data_inicio, data_fim=data_fim,
        sort_by=sort_by, sort_dir=sort_dir,
    )
    return PedidoListResponse(items=items, total=total, page=page, limit=limit, pages=pages)


@router.get("/{pedido_id}", response_model=PedidoDetailResponse)
def get_pedido(
    pedido_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_dep),
):
    try:
        pedido = PedidoService.get_by_id(db, pedido_id)
        history = PedidoService.get_status_history(db, pedido_id)
        response = PedidoDetailResponse.model_validate(pedido)
        response.status_history = [StatusHistoryOut.model_validate(h) for h in history]
        return response
    except NotFoundException as exc:
        raise to_http_exception(exc)


@router.put("/{pedido_id}", response_model=PedidoResponse)
def update_pedido(
    pedido_id: UUID,
    data: PedidoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return PedidoService.update(db, pedido_id, data, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch("/{pedido_id}/status", response_model=PedidoResponse)
def change_status(
    pedido_id: UUID,
    data: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return PedidoService.change_status(db, pedido_id, data.new_status, current_user.id, data.reason)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except BusinessLogicException as exc:
        raise to_http_exception(exc)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.delete("/{pedido_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pedido(
    pedido_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        PedidoService.soft_delete(db, pedido_id, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
