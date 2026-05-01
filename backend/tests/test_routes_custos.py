import uuid
import pytest
from decimal import Decimal
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.custos_pedido import router
from app.schemas.pedido import CustoComFinancialsOut, FinancialsOut
from app.utils.errors import NotFoundException, BusinessLogicException
from app.database import get_db
from app.api.routes.auth import get_current_user_dep


def _custo_response():
    return CustoComFinancialsOut(
        id=uuid.uuid4(),
        custo_produto_inicial=None,
        custo_produto_final=Decimal("500.00"),
        custo_servico=None,
        brinde=None,
        pct_imposto_compra=None,
        imposto_compra=None,
        pct_imposto_venda=None,
        imposto_venda=None,
        pct_custo_credito=None,
        custo_credito=None,
        pct_custo_debito=None,
        custo_debito=None,
        custo_boleto=None,
        financials=FinancialsOut(
            custo_total=Decimal("500.00"),
            lucro_liquido=Decimal("500.00"),
            margem_bruta_pct=Decimal("50.00"),
        ),
    )


def _no_auth_client(mock_db):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: mock_db
    return TestClient(app, raise_server_exceptions=False)


# ── POST /pedidos/{id}/costs ──────────────────────────────────────────────────

def test_create_costs_success(make_test_client):
    client = make_test_client(router)
    payload = {"custo_produto_final": "500.00"}
    with patch("app.api.routes.custos_pedido.CustoPedidoService.create_costs") as m:
        m.return_value = _custo_response()
        r = client.post(f"/pedidos/{uuid.uuid4()}/costs", json=payload)
    assert r.status_code == 201
    assert "financials" in r.json()
    assert r.json()["financials"]["custo_total"] == "500.00"


def test_create_costs_conflict(make_test_client):
    client = make_test_client(router)
    with patch("app.api.routes.custos_pedido.CustoPedidoService.create_costs") as m:
        m.side_effect = BusinessLogicException("Pedido já possui custos.")
        r = client.post(f"/pedidos/{uuid.uuid4()}/costs", json={})
    assert r.status_code == 400


def test_create_costs_pedido_not_found(make_test_client):
    client = make_test_client(router)
    with patch("app.api.routes.custos_pedido.CustoPedidoService.create_costs") as m:
        m.side_effect = NotFoundException("Pedido não encontrado")
        r = client.post(f"/pedidos/{uuid.uuid4()}/costs", json={})
    assert r.status_code == 404


# ── PUT /pedidos/{id}/costs ───────────────────────────────────────────────────

def test_update_costs_success(make_test_client):
    client = make_test_client(router)
    payload = {"custo_produto_final": "600.00"}
    with patch("app.api.routes.custos_pedido.CustoPedidoService.update_costs") as m:
        m.return_value = _custo_response()
        r = client.put(f"/pedidos/{uuid.uuid4()}/costs", json=payload)
    assert r.status_code == 200
    assert "financials" in r.json()


def test_update_costs_not_found(make_test_client):
    client = make_test_client(router)
    with patch("app.api.routes.custos_pedido.CustoPedidoService.update_costs") as m:
        m.side_effect = NotFoundException("Custo não encontrado.")
        r = client.put(f"/pedidos/{uuid.uuid4()}/costs", json={})
    assert r.status_code == 404


def test_update_costs_no_auth(mock_db):
    client = _no_auth_client(mock_db)
    r = client.put(f"/pedidos/{uuid.uuid4()}/costs", json={})
    assert r.status_code == 401
