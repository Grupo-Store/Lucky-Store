from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.status_history import StatusHistory, EntityType
from app.models.audit_log import AuditLog
from app.schemas.produto import ProdutoCreate, ProdutoUpdate, ProdutoStatusUpdate, ProdutoResponse
from app.schemas.status_history import StatusHistoryResponse
from app.schemas.audit_log import AuditLogResponse
from app.services.item_pedido import ItemPedidoService
from app.utils.errors import NotFoundException, to_http_exception
from app.api.routes.auth import get_current_user_dep


class ItemHistoryResponse(BaseModel):
    item_id: UUID
    status_history: List[StatusHistoryResponse]
    audit_logs: List[AuditLogResponse]

router = APIRouter(prefix="/pedidos", tags=["itens-pedido"])


@router.post("/{pedido_id}/items", response_model=ProdutoResponse, status_code=status.HTTP_201_CREATED)
def add_item(
    pedido_id: UUID,
    data: ProdutoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return ItemPedidoService.add_item(db, pedido_id, data, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.put("/{pedido_id}/items/{item_id}", response_model=ProdutoResponse)
def update_item(
    pedido_id: UUID,
    item_id: UUID,
    data: ProdutoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return ItemPedidoService.update_item(db, pedido_id, item_id, data, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch("/{pedido_id}/items/{item_id}/status", response_model=ProdutoResponse)
def update_item_status(
    pedido_id: UUID,
    item_id: UUID,
    data: ProdutoStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return ItemPedidoService.update_item_status(db, pedido_id, item_id, data.new_status, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{pedido_id}/items/{item_id}/history", response_model=ItemHistoryResponse)
def get_item_history(
    pedido_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user_dep),
):
    status_history = (
        db.query(StatusHistory)
        .filter(
            StatusHistory.entity_type == EntityType.PRODUTO,
            StatusHistory.entity_id == item_id,
        )
        .order_by(StatusHistory.changed_at.asc())
        .all()
    )
    audit_logs = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == "produto", AuditLog.entity_id == item_id)
        .order_by(AuditLog.changed_at.asc())
        .all()
    )
    return ItemHistoryResponse(
        item_id=item_id,
        status_history=[StatusHistoryResponse.model_validate(h) for h in status_history],
        audit_logs=[AuditLogResponse.model_validate(log) for log in audit_logs],
    )


@router.delete("/{pedido_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(
    pedido_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        ItemPedidoService.remove_item(db, pedido_id, item_id, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
