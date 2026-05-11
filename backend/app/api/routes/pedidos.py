from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from app.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.status_history import StatusHistory, EntityType
from app.schemas.pedido import (
    PedidoCreate, PedidoUpdate, PedidoResponse,
    PedidoDetailResponse, PedidoListResponse, PedidoListItemResponse,
    StatusChangeRequest, StatusHistoryOut,
)
from app.schemas.audit_log import AuditLogResponse
from app.schemas.status_history import StatusHistoryResponse
from app.services.pedido import PedidoService
from app.utils.errors import NotFoundException, BusinessLogicException, to_http_exception
from app.api.routes.auth import get_current_user_dep
from pydantic import BaseModel


class OrderHistoryResponse(BaseModel):
    order_id: UUID
    status_history: List[StatusHistoryResponse]
    audit_logs: List[AuditLogResponse]


router = APIRouter(prefix="/pedidos", tags=["pedidos"])


@router.post("", response_model=PedidoResponse, status_code=status.HTTP_201_CREATED)
def create_pedido(
    request: Request,
    data: PedidoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    try:
        return PedidoService.create(db, data, current_user.id, ip_address=ip, user_agent=ua)
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
    items_out = [
        PedidoListItemResponse(
            id=p.id,
            numero_os=p.numero_os,
            data_pedido=p.data_pedido,
            data_entrega=p.data_entrega,
            status=p.status,
            is_rma=p.is_rma,
            is_cancelled=p.is_cancelled,
            valor_venda=p.valor_venda,
            nome_cliente=p.cliente.nome if p.cliente else None,
            nome_loja=p.loja.nome if p.loja else None,
            nome_vendedor=p.vendedor.nome if p.vendedor else None,
        )
        for p in items
    ]
    return PedidoListResponse(items=items_out, total=total, page=page, limit=limit, pages=pages)


@router.get("/{pedido_id}/history", response_model=OrderHistoryResponse)
def get_order_history(
    pedido_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_dep),
):
    status_history = (
        db.query(StatusHistory)
        .filter(
            StatusHistory.entity_type == EntityType.PEDIDO,
            StatusHistory.entity_id == pedido_id,
        )
        .order_by(StatusHistory.changed_at.asc())
        .all()
    )
    audit_logs = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == "pedido", AuditLog.entity_id == pedido_id)
        .order_by(AuditLog.changed_at.asc())
        .all()
    )
    return OrderHistoryResponse(
        order_id=pedido_id,
        status_history=[StatusHistoryResponse.model_validate(h) for h in status_history],
        audit_logs=[AuditLogResponse.model_validate(log) for log in audit_logs],
    )


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
    request: Request,
    pedido_id: UUID,
    data: PedidoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    try:
        return PedidoService.update(db, pedido_id, data, current_user.id, ip_address=ip, user_agent=ua)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch("/{pedido_id}/status", response_model=PedidoResponse)
def change_status(
    request: Request,
    pedido_id: UUID,
    data: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    try:
        return PedidoService.change_status(
            db, pedido_id, data.new_status, current_user.id, data.reason,
            ip_address=ip, user_agent=ua,
        )
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except BusinessLogicException as exc:
        raise to_http_exception(exc)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.delete("/{pedido_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pedido(
    request: Request,
    pedido_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    try:
        PedidoService.soft_delete(db, pedido_id, current_user.id, ip_address=ip, user_agent=ua)
    except NotFoundException as exc:
        raise to_http_exception(exc)
