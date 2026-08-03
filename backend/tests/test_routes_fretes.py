import uuid
import pytest
from decimal import Decimal
from datetime import date
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.fretes import router
from app.database import get_db
from app.api.routes.auth import get_current_user_dep


# ── Helpers ───────────────────────────────────────────────────────────────────

def _summary_result(n=2):
    return {
        "total_entregas": n,
        "entregadores_ativos": 1,
        "valor_total": Decimal("60.00"),
        "a_pagar": Decimal("30.00"),
        "por_entregador": [
            {
                "entregador": "Alfredo",
                "qtd_entregas": n,
                "valor_total": Decimal("60.00"),
                "a_pagar": Decimal("30.00"),
            }
        ],
    }


def _detail_result():
    pedido_id = uuid.uuid4()
    return {
        "items": [
            {
                "id": uuid.uuid4(),
                "id_pedido": pedido_id,
                "numero_os": "OS042",
                "nome_cliente": "Hospital das Clínicas",
                "entregador": "Alfredo",
                "data_frete": date(2026, 5, 20),
                "valor": Decimal("30.00"),
                "pago": False,
            }
        ]
    }


def _no_auth_client(mock_db):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: mock_db
    return TestClient(app, raise_server_exceptions=False)


# ── GET /fretes/summary ───────────────────────────────────────────────────────

def test_summary_returns_aggregated_data(make_test_client):
    client = make_test_client(router)
    with patch("app.api.routes.fretes.FretesService.get_summary") as m:
        m.return_value = _summary_result()
        r = client.get("/fretes/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["total_entregas"] == 2
    assert body["entregadores_ativos"] == 1
    assert float(body["valor_total"]) == pytest.approx(60.0)
    assert float(body["a_pagar"]) == pytest.approx(30.0)
    assert len(body["por_entregador"]) == 1
    assert body["por_entregador"][0]["entregador"] == "Alfredo"


def test_summary_empty_period(make_test_client):
    client = make_test_client(router)
    with patch("app.api.routes.fretes.FretesService.get_summary") as m:
        m.return_value = {
            "total_entregas": 0,
            "entregadores_ativos": 0,
            "valor_total": Decimal("0"),
            "a_pagar": Decimal("0"),
            "por_entregador": [],
        }
        r = client.get("/fretes/summary")
    assert r.status_code == 200
    assert r.json()["total_entregas"] == 0
    assert r.json()["por_entregador"] == []


def test_summary_passes_filters_to_service(make_test_client):
    client = make_test_client(router)
    loja_id = str(uuid.uuid4())
    with patch("app.api.routes.fretes.FretesService.get_summary") as m:
        m.return_value = _summary_result()
        r = client.get(
            f"/fretes/summary?id_loja={loja_id}&data_inicio=2026-05-01&data_fim=2026-05-31"
        )
    assert r.status_code == 200
    call_kwargs = m.call_args.kwargs
    assert str(call_kwargs["id_loja"]) == loja_id
    assert call_kwargs["data_inicio"] == date(2026, 5, 1)
    assert call_kwargs["data_fim"] == date(2026, 5, 31)


def test_summary_requires_auth(mock_db):
    client = _no_auth_client(mock_db)
    r = client.get("/fretes/summary")
    assert r.status_code == 401


def test_summary_invalid_date_format(make_test_client):
    client = make_test_client(router)
    r = client.get("/fretes/summary?data_inicio=31-05-2026")
    assert r.status_code == 422


# ── GET /fretes/detail ────────────────────────────────────────────────────────

def test_detail_returns_fretes_for_entregador(make_test_client):
    client = make_test_client(router)
    with patch("app.api.routes.fretes.FretesService.get_detail") as m:
        m.return_value = _detail_result()
        r = client.get("/fretes/detail?entregador=Alfredo")
    assert r.status_code == 200
    body = r.json()
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["entregador"] == "Alfredo"
    assert item["numero_os"] == "OS042"
    assert item["nome_cliente"] == "Hospital das Clínicas"
    assert item["pago"] is False
    assert float(item["valor"]) == pytest.approx(30.0)


def test_detail_empty_result(make_test_client):
    client = make_test_client(router)
    with patch("app.api.routes.fretes.FretesService.get_detail") as m:
        m.return_value = {"items": []}
        r = client.get("/fretes/detail?entregador=NaoExiste")
    assert r.status_code == 200
    assert r.json()["items"] == []


def test_detail_passes_entregador_to_service(make_test_client):
    client = make_test_client(router)
    with patch("app.api.routes.fretes.FretesService.get_detail") as m:
        m.return_value = {"items": []}
        r = client.get("/fretes/detail?entregador=Alfredo&data_inicio=2026-05-01&data_fim=2026-05-07")
    assert r.status_code == 200
    call_kwargs = m.call_args.kwargs
    assert call_kwargs["entregador"] == "Alfredo"
    assert call_kwargs["data_inicio"] == date(2026, 5, 1)
    assert call_kwargs["data_fim"] == date(2026, 5, 7)


def test_detail_without_entregador_filter(make_test_client):
    """Without entregador param, service is called with entregador=None (returns all)."""
    client = make_test_client(router)
    with patch("app.api.routes.fretes.FretesService.get_detail") as m:
        m.return_value = _detail_result()
        r = client.get("/fretes/detail")
    assert r.status_code == 200
    call_kwargs = m.call_args.kwargs
    assert call_kwargs["entregador"] is None


def test_detail_requires_auth(mock_db):
    client = _no_auth_client(mock_db)
    r = client.get("/fretes/detail")
    assert r.status_code == 401


# ── FretesService unit tests (no HTTP layer) ──────────────────────────────────

def _make_frete(valor="30.00", entregador="Alfredo", pago=False):
    f = type("Frete", (), {})()
    f.id = uuid.uuid4()
    f.id_pedido = uuid.uuid4()
    f.entregador = entregador
    f.valor = Decimal(valor)
    f.data_frete = date(2026, 5, 20)
    f.pago = pago
    return f


def _make_pedido(numero_os="OS042", nome_cliente="Hospital X", loja_id=None):
    p = type("Pedido", (), {})()
    p.id = uuid.uuid4()
    p.numero_os = numero_os
    p.id_loja = loja_id or uuid.uuid4()
    c = type("Cliente", (), {"nome": nome_cliente})()
    p.cliente = c
    return p


def test_service_summary_aggregates_by_entregador(mock_db):
    from app.services.fretes import FretesService

    frete1 = _make_frete("30.00", "Alfredo", pago=True)
    frete2 = _make_frete("20.00", "Alfredo", pago=False)
    frete3 = _make_frete("50.00", "João", pago=False)

    pedido = _make_pedido()
    rows = [(frete1, pedido), (frete2, pedido), (frete3, pedido)]

    # Configure mock db query chain to return rows
    chain = mock_db.query.return_value
    chain.join.return_value = chain
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.all.return_value = rows

    result = FretesService.get_summary(mock_db)

    assert result["total_entregas"] == 3
    assert result["entregadores_ativos"] == 2
    assert result["valor_total"] == Decimal("100.00")
    assert result["a_pagar"] == Decimal("70.00")
    entregadores = {e["entregador"]: e for e in result["por_entregador"]}
    assert entregadores["Alfredo"]["qtd_entregas"] == 2
    assert entregadores["Alfredo"]["a_pagar"] == Decimal("20.00")
    assert entregadores["João"]["qtd_entregas"] == 1
    assert entregadores["João"]["a_pagar"] == Decimal("50.00")


def test_service_summary_null_entregador_becomes_dash(mock_db):
    from app.services.fretes import FretesService

    frete = _make_frete("15.00", entregador=None)
    pedido = _make_pedido()
    rows = [(frete, pedido)]

    chain = mock_db.query.return_value
    chain.join.return_value = chain
    chain.filter.return_value = chain
    chain.all.return_value = rows

    result = FretesService.get_summary(mock_db)
    assert result["por_entregador"][0]["entregador"] == "—"


def test_service_summary_empty_returns_zeros(mock_db):
    from app.services.fretes import FretesService

    chain = mock_db.query.return_value
    chain.join.return_value = chain
    chain.filter.return_value = chain
    chain.all.return_value = []

    result = FretesService.get_summary(mock_db)
    assert result["total_entregas"] == 0
    assert result["entregadores_ativos"] == 0
    assert result["valor_total"] == Decimal("0")
    assert result["a_pagar"] == Decimal("0")


def test_service_detail_filters_by_entregador(mock_db):
    from app.services.fretes import FretesService

    frete = _make_frete("30.00", "Alfredo")
    pedido = _make_pedido("OS042", "Santa Casa")
    rows = [(frete, pedido)]

    chain = mock_db.query.return_value
    chain.join.return_value = chain
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.all.return_value = rows

    result = FretesService.get_detail(mock_db, entregador="Alfredo")
    assert len(result["items"]) == 1
    item = result["items"][0]
    assert item["entregador"] == "Alfredo"
    assert item["numero_os"] == "OS042"
    assert item["nome_cliente"] == "Santa Casa"
    assert item["valor"] == Decimal("30.00")
    assert item["pago"] is False


def test_service_detail_null_entregador_shows_dash(mock_db):
    from app.services.fretes import FretesService

    frete = _make_frete("10.00", entregador=None)
    pedido = _make_pedido()
    rows = [(frete, pedido)]

    chain = mock_db.query.return_value
    chain.join.return_value = chain
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.all.return_value = rows

    result = FretesService.get_detail(mock_db)
    assert result["items"][0]["entregador"] == "—"


def test_service_detail_no_cliente(mock_db):
    from app.services.fretes import FretesService

    frete = _make_frete()
    pedido = _make_pedido()
    pedido.cliente = None
    rows = [(frete, pedido)]

    chain = mock_db.query.return_value
    chain.join.return_value = chain
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.all.return_value = rows

    result = FretesService.get_detail(mock_db)
    assert result["items"][0]["nome_cliente"] is None
