from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.schemas.cotacao import ConversaoResponse
from app.services.conversao_cotacao import ConversaoCotacaoService
from app.utils.errors import NotFoundException, BusinessLogicException, to_http_exception
from app.api.routes.auth import get_current_user_dep

router = APIRouter(prefix="/quotes", tags=["quote-conversion"])


@router.post("/{quote_id}/convert", response_model=ConversaoResponse, status_code=status.HTTP_201_CREATED)
def convert_to_pedido(
    quote_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        pedido = ConversaoCotacaoService.convert_to_pedido(db, quote_id, current_user.id)
        return ConversaoResponse(
            id_pedido=pedido.id,
            id_cotacao=quote_id,
        )
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except BusinessLogicException as exc:
        raise to_http_exception(exc)
