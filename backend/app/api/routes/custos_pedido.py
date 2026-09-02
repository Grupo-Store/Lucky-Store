from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.models.user import User
from app.schemas.pedido import CustoPedidoIn, CustoComFinancialsOut
from app.services.custo_pedido import CustoPedidoService
from app.utils.errors import NotFoundException, BusinessLogicException, to_http_exception, erro_http
from app.api.routes.auth import get_current_user_dep

router = APIRouter(prefix="/pedidos", tags=["custos-pedido"])


@router.post("/{pedido_id}/costs", response_model=CustoComFinancialsOut, status_code=status.HTTP_201_CREATED)
def create_costs(
    pedido_id: UUID,
    data: CustoPedidoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return CustoPedidoService.create_costs(db, pedido_id, data, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except BusinessLogicException as exc:
        raise to_http_exception(exc)
    except Exception as exc:
        raise erro_http(exc, "salvar os custos do pedido")


@router.put("/{pedido_id}/costs", response_model=CustoComFinancialsOut)
def update_costs(
    pedido_id: UUID,
    data: CustoPedidoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    try:
        return CustoPedidoService.update_costs(db, pedido_id, data, current_user.id)
    except NotFoundException as exc:
        raise to_http_exception(exc)
    except BusinessLogicException as exc:
        raise to_http_exception(exc)
    except Exception as exc:
        raise erro_http(exc, "salvar os custos do pedido")
