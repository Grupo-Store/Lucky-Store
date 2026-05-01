import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.pagamentos_pedido import router
from app.schemas.pedido import FormaPagamentoOut
from app.utils.errors import NotFoundException
from app.database import get_db
from app.api.routes.auth import get_current_user_dep


def _pagamento_response():
    return FormaPagamentoOut(id=uuid.uuid4(), forma="Crédito")


def _no_auth_client(mock_db):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: mock_db
    return TestClient(app, raise_server_exceptions=False)


def test_add_payment_success(make_test_client):
    client = make_test_client(router)
    with patch("app.api.routes.pagamentos_pedido.PagamentoPedidoService.add_payment_method") as m:
        m.return_value = _pagamento_response()
        r = client.post(f"/pedidos/{uuid.uuid4()}/payment-methods", json={"forma": "Crédito"})
    assert r.status_code == 201
    assert r.json()["forma"] == "Crédito"


def test_add_payment_pedido_not_found(make_test_client):
    client = make_test_client(router)
    with patch("app.api.routes.pagamentos_pedido.PagamentoPedidoService.add_payment_method") as m:
        m.side_effect = NotFoundException("Pedido não encontrado")
        r = client.post(f"/pedidos/{uuid.uuid4()}/payment-methods", json={"forma": "Boleto"})
    assert r.status_code == 404


def test_add_payment_no_auth(mock_db):
    client = _no_auth_client(mock_db)
    r = client.post(f"/pedidos/{uuid.uuid4()}/payment-methods", json={"forma": "Débito"})
    assert r.status_code == 401
