from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.models.user import User
from app.schemas.produto import ProdutoCreate, ProdutoStatusUpdate, ProdutoResponse
from app.services.item_pedido import ItemPedidoService
from app.utils.errors import NotFoundException, to_http_exception
from app.api.routes.auth import get_current_user_dep

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
