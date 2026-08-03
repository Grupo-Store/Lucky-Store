"""Tests for GET /api/calendar/entries."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.api.routes.calendar import router
from app.database import get_db
from app.api.routes.auth import get_current_user_dep


# ── helpers ───────────────────────────────────────────────────────────────────

def _fake_expense(data_prevista: date, valor=Decimal("5000.00"), data_paga=None, **kw):
    e = MagicMock()
    e.id = uuid.uuid4()
    e.descricao = kw.get("descricao", "Aluguel")
    e.valor = valor
    e.data_prevista = data_prevista
    e.data_paga = data_paga
    return e


def _fake_pedido(data_pagamento=None, multa=None, juros=None, plano_parcelas=None):
    p = MagicMock()
    p.id = uuid.uuid4()
    p.numero_os = f"OS-{uuid.uuid4().hex[:3].upper()}"
    p.data_pagamento = data_pagamento
    p.multa = multa
    p.juros = juros
    p.plano_parcelas = plano_parcelas
    return p


def _no_auth_client(mock_db):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: mock_db
    return TestClient(app, raise_server_exceptions=False)


def _setup_mock_db(mock_db, expenses=None, pedidos_pagos=None, pedidos_parcelados=None):
    """Wire mock_db.query so each model class returns distinct query chains.

    The calendar route calls db.query(Pedido) twice: once for multa/juros
    (filtered by data_pagamento) and once for parcelas. We track the call
    count to return the correct result set for each invocation.
    """
    from app.models.expense import Expense
    from app.models.pedido import Pedido

    expenses = expenses or []
    pedidos_pagos = pedidos_pagos or []
    pedidos_parcelados = pedidos_parcelados or []

    pedido_results = [pedidos_pagos, pedidos_parcelados]
    pedido_call_idx = [0]

    def query_side_effect(model):
        q = MagicMock()
        if model is Expense:
            q.filter.return_value.all.return_value = expenses
        elif model is Pedido:
            idx = pedido_call_idx[0]
            pedido_call_idx[0] += 1
            results = pedido_results[idx] if idx < len(pedido_results) else []
            q.filter.return_value.all.return_value = results
        return q

    mock_db.query.side_effect = query_side_effect
    return mock_db


# ── tests ─────────────────────────────────────────────────────────────────────

class TestCalendarEntries:

    BASE_URL = "/calendar/entries"

    def _url(self, loja_id, ano=2026, mes=5):
        return f"{self.BASE_URL}?ano={ano}&mes={mes}&id_loja={loja_id}"

    def test_empty_month_returns_empty_dict(self, make_test_client, mock_db):
        _setup_mock_db(mock_db)
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        assert r.status_code == 200
        assert r.json() == {}

    def test_expense_appears_on_correct_date(self, make_test_client, mock_db):
        expense = _fake_expense(date(2026, 5, 10))
        _setup_mock_db(mock_db, expenses=[expense])
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        assert r.status_code == 200
        body = r.json()
        assert "2026-05-10" in body
        entries = body["2026-05-10"]
        assert len(entries) == 1
        assert entries[0]["tipo"] == "expense"
        assert entries[0]["valor"] == 5000.0
        assert entries[0]["pago"] is False

    def test_expense_pago_flag_when_data_paga_set(self, make_test_client, mock_db):
        expense = _fake_expense(date(2026, 5, 10), data_paga=date(2026, 5, 8))
        _setup_mock_db(mock_db, expenses=[expense])
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        body = r.json()
        assert body["2026-05-10"][0]["pago"] is True

    def test_multa_appears_on_data_pagamento(self, make_test_client, mock_db):
        pedido = _fake_pedido(
            data_pagamento=date(2026, 5, 15),
            multa=Decimal("150.00"),
        )
        _setup_mock_db(mock_db, pedidos_pagos=[pedido])
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        body = r.json()
        assert "2026-05-15" in body
        multas = [e for e in body["2026-05-15"] if e["tipo"] == "multa"]
        assert len(multas) == 1
        assert multas[0]["valor"] == 150.0
        assert multas[0]["numero_os"] == pedido.numero_os

    def test_juros_appears_on_data_pagamento(self, make_test_client, mock_db):
        pedido = _fake_pedido(
            data_pagamento=date(2026, 5, 15),
            juros=Decimal("75.00"),
        )
        _setup_mock_db(mock_db, pedidos_pagos=[pedido])
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        body = r.json()
        juros_entries = [e for e in body["2026-05-15"] if e["tipo"] == "juros"]
        assert len(juros_entries) == 1
        assert juros_entries[0]["valor"] == 75.0

    def test_pedido_with_both_multa_and_juros(self, make_test_client, mock_db):
        pedido = _fake_pedido(
            data_pagamento=date(2026, 5, 20),
            multa=Decimal("100.00"),
            juros=Decimal("50.00"),
        )
        _setup_mock_db(mock_db, pedidos_pagos=[pedido])
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        body = r.json()
        entries = body["2026-05-20"]
        tipos = {e["tipo"] for e in entries}
        assert "multa" in tipos
        assert "juros" in tipos

    def test_parcela_indexed_by_parcela_date(self, make_test_client, mock_db):
        pedido = _fake_pedido(
            plano_parcelas=[
                {"date": "2026-05-15", "value": 833.33},
                {"date": "2026-06-15", "value": 833.33},
            ]
        )
        _setup_mock_db(mock_db, pedidos_parcelados=[pedido])
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        body = r.json()
        assert "2026-05-15" in body
        # june parcela must NOT appear in may calendar
        assert "2026-06-15" not in body
        parcela = body["2026-05-15"][0]
        assert parcela["tipo"] == "parcela"
        assert parcela["numero_parcela"] == 1
        assert parcela["total_parcelas"] == 2
        assert parcela["valor"] == 833.33

    def test_multiple_parcelas_in_same_month(self, make_test_client, mock_db):
        pedido = _fake_pedido(
            plano_parcelas=[
                {"date": "2026-05-01", "value": 500.00},
                {"date": "2026-05-15", "value": 500.00},
                {"date": "2026-05-31", "value": 500.00},
            ]
        )
        _setup_mock_db(mock_db, pedidos_parcelados=[pedido])
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        body = r.json()
        assert "2026-05-01" in body
        assert "2026-05-15" in body
        assert "2026-05-31" in body

    def test_mixed_entries_on_same_date(self, make_test_client, mock_db):
        expense = _fake_expense(date(2026, 5, 15))
        pedido = _fake_pedido(data_pagamento=date(2026, 5, 15), multa=Decimal("200.00"))
        _setup_mock_db(mock_db, expenses=[expense], pedidos_pagos=[pedido])
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        body = r.json()
        assert "2026-05-15" in body
        assert len(body["2026-05-15"]) == 2
        tipos = {e["tipo"] for e in body["2026-05-15"]}
        assert "expense" in tipos
        assert "multa" in tipos

    def test_missing_id_loja_returns_422(self, make_test_client, mock_db):
        client = make_test_client(router)
        r = client.get("/calendar/entries?ano=2026&mes=5")
        assert r.status_code == 422

    def test_missing_ano_returns_422(self, make_test_client, mock_db):
        client = make_test_client(router)
        r = client.get(f"/calendar/entries?mes=5&id_loja={uuid.uuid4()}")
        assert r.status_code == 422

    def test_invalid_mes_returns_422(self, make_test_client, mock_db):
        client = make_test_client(router)
        r = client.get(f"/calendar/entries?ano=2026&mes=13&id_loja={uuid.uuid4()}")
        assert r.status_code == 422

    def test_no_auth_returns_401(self, mock_db):
        client = _no_auth_client(mock_db)
        r = client.get(self._url(uuid.uuid4()))
        assert r.status_code == 401

    def test_parcela_with_invalid_date_skipped(self, make_test_client, mock_db):
        pedido = _fake_pedido(
            plano_parcelas=[
                {"date": "not-a-date", "value": 100.00},
                {"date": "2026-05-10", "value": 200.00},
            ]
        )
        _setup_mock_db(mock_db, pedidos_parcelados=[pedido])
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        body = r.json()
        assert "2026-05-10" in body
        assert len(body["2026-05-10"]) == 1

    def test_parcela_missing_date_key_skipped(self, make_test_client, mock_db):
        pedido = _fake_pedido(
            plano_parcelas=[
                {"value": 100.00},  # no "date" key
                {"date": "2026-05-20", "value": 500.00},
            ]
        )
        _setup_mock_db(mock_db, pedidos_parcelados=[pedido])
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        body = r.json()
        assert "2026-05-20" in body

    def test_pedido_without_multa_juros_skipped(self, make_test_client, mock_db):
        pedido = _fake_pedido(data_pagamento=date(2026, 5, 10), multa=None, juros=None)
        _setup_mock_db(mock_db, pedidos_pagos=[pedido])
        client = make_test_client(router)
        r = client.get(self._url(uuid.uuid4()))
        body = r.json()
        assert "2026-05-10" not in body

    def test_february_last_day(self, make_test_client, mock_db):
        """Leap year: Feb 2028 has 29 days."""
        expense = _fake_expense(date(2028, 2, 29))
        _setup_mock_db(mock_db, expenses=[expense])
        client = make_test_client(router)
        r = client.get(f"/calendar/entries?ano=2028&mes=2&id_loja={uuid.uuid4()}")
        assert r.status_code == 200
        assert "2028-02-29" in r.json()
