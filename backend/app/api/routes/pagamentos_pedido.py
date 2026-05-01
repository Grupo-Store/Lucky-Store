from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.models.user import User
from app.schemas.pedido import FormaPagamentoIn, FormaPagamentoOut
from app.services.pagamento_pedido import PagamentoPedidoService
from app.utils.errors import NotFoundException, to_http_exception
from app.api.routes.auth import get_current_user_dep

router = APIRouter(prefix="/pedidos", tags=["pagamentos-pedido"])


@router.post("/{pedido_id}/payment-methods", response_model=FormaPagamentoOut, status_code=status.HTTP_201_CREATED)
def add_payment_method(
    pedido_id: UUID,
    data: FormaPagamentoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return PagamentoPedidoService.add_payment_method(db, pedido_id, data, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
