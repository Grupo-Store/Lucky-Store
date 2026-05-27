from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.schemas.cotacao import ItemCotacaoCreate, ItemCotacaoResponse
from app.services.item_cotacao import ItemCotacaoService
from app.utils.errors import NotFoundException, to_http_exception
from app.api.routes.auth import get_current_user_dep

router = APIRouter(prefix="/quotes", tags=["quote-items"])


@router.post("/{quote_id}/items", response_model=ItemCotacaoResponse, status_code=status.HTTP_201_CREATED)
def add_item(
    quote_id: UUID,
    data: ItemCotacaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return ItemCotacaoService.add_item(db, quote_id, data, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{quote_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(
    quote_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        ItemCotacaoService.remove_item(db, quote_id, item_id, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
