"""Tests for /api/expenses CRUD routes."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.api.routes.expenses import router
from app.database import get_db
from app.api.routes.auth import get_current_user_dep


# ── helpers ───────────────────────────────────────────────────────────────────

def _fake_expense(**overrides):
    e = MagicMock()
    e.id = uuid.uuid4()
    e.id_loja = uuid.uuid4()
    e.descricao = "Aluguel maio"
    e.valor = Decimal("5000.00")
    e.data_prevista = date(2026, 5, 10)
    e.data_paga = None
    e.recorrente = True
    e.parcelas = None
    e.created_by = uuid.uuid4()
    e.created_at = datetime.now(timezone.utc)
    e.deleted_at = None
    for k, v in overrides.items():
        setattr(e, k, v)
    return e


_CREATE_PAYLOAD = {
    "descricao": "Aluguel maio",
    "valor": "5000.00",
    "data_prevista": "2026-05-10",
    "data_paga": None,
    "recorrente": True,
    "id_loja": str(uuid.uuid4()),
    "parcelas": None,
}


def _no_auth_client(mock_db):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: mock_db
    return TestClient(app, raise_server_exceptions=False)


# ── POST /expenses ────────────────────────────────────────────────────────────

class TestCreateExpense:

    def test_creates_and_returns_201(self, make_test_client):
        client = make_test_client(router)
        expense = _fake_expense()

        def fake_refresh(obj):
            obj.id = expense.id
            obj.created_at = expense.created_at

        mock_db = MagicMock()
        mock_db.refresh.side_effect = fake_refresh

        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from app.models.user import UserRole

        class _FakeUser:
            id = uuid.uuid4()
            role = UserRole.ADMIN

        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user_dep] = lambda: _FakeUser()
        c = TestClient(app)

        r = c.post("/expenses", json=_CREATE_PAYLOAD)
        assert r.status_code == 201
        body = r.json()
        assert body["descricao"] == "Aluguel maio"
        assert body["valor"] == "5000.00"
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    def test_missing_descricao_returns_422(self, make_test_client):
        client = make_test_client(router)
        payload = {k: v for k, v in _CREATE_PAYLOAD.items() if k != "descricao"}
        r = client.post("/expenses", json=payload)
        assert r.status_code == 422

    def test_missing_valor_returns_422(self, make_test_client):
        client = make_test_client(router)
        payload = {k: v for k, v in _CREATE_PAYLOAD.items() if k != "valor"}
        r = client.post("/expenses", json=payload)
        assert r.status_code == 422

    def test_no_auth_returns_401(self, mock_db):
        client = _no_auth_client(mock_db)
        r = client.post("/expenses", json=_CREATE_PAYLOAD)
        assert r.status_code == 401


# ── GET /expenses ─────────────────────────────────────────────────────────────

class TestListExpenses:

    def _setup_mock_db(self, mock_db, expenses, total=None):
        total = total if total is not None else len(expenses)
        q = mock_db.query.return_value
        q.filter.return_value.count.return_value = total
        q.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = expenses
        return mock_db

    def test_returns_200_with_items(self, make_test_client, mock_db):
        expense = _fake_expense()
        self._setup_mock_db(mock_db, [expense])
        client = make_test_client(router)
        r = client.get(f"/expenses?id_loja={expense.id_loja}")
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 1
        assert len(body["items"]) == 1
        assert body["items"][0]["descricao"] == "Aluguel maio"

    def test_empty_result(self, make_test_client, mock_db):
        self._setup_mock_db(mock_db, [])
        client = make_test_client(router)
        r = client.get(f"/expenses?id_loja={uuid.uuid4()}")
        assert r.status_code == 200
        assert r.json()["total"] == 0
        assert r.json()["items"] == []

    def test_pagination_params_propagated(self, make_test_client, mock_db):
        self._setup_mock_db(mock_db, [])
        client = make_test_client(router)
        r = client.get(f"/expenses?id_loja={uuid.uuid4()}&page=2&limit=5")
        assert r.status_code == 200
        assert r.json()["page"] == 2
        assert r.json()["limit"] == 5

    def test_missing_id_loja_returns_422(self, make_test_client, mock_db):
        client = make_test_client(router)
        r = client.get("/expenses")
        assert r.status_code == 422

    def test_no_auth_returns_401(self, mock_db):
        client = _no_auth_client(mock_db)
        r = client.get(f"/expenses?id_loja={uuid.uuid4()}")
        assert r.status_code == 401

    def test_with_date_filters(self, make_test_client, mock_db):
        self._setup_mock_db(mock_db, [])
        client = make_test_client(router)
        r = client.get(
            f"/expenses?id_loja={uuid.uuid4()}"
            "&data_inicio=2026-05-01&data_fim=2026-05-31"
        )
        assert r.status_code == 200


# ── PATCH /expenses/{id} ──────────────────────────────────────────────────────

class TestUpdateExpense:

    def test_updates_and_returns_200(self, make_test_client, mock_db):
        expense = _fake_expense()
        mock_db.query.return_value.filter.return_value.first.return_value = expense
        client = make_test_client(router)
        r = client.patch(f"/expenses/{expense.id}", json={"data_paga": "2026-05-08"})
        assert r.status_code == 200
        mock_db.commit.assert_called_once()

    def test_not_found_returns_404(self, make_test_client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = None
        client = make_test_client(router)
        r = client.patch(f"/expenses/{uuid.uuid4()}", json={"descricao": "X"})
        assert r.status_code == 404

    def test_no_auth_returns_401(self, mock_db):
        client = _no_auth_client(mock_db)
        r = client.patch(f"/expenses/{uuid.uuid4()}", json={"descricao": "X"})
        assert r.status_code == 401

    def test_patch_only_provided_fields(self, make_test_client, mock_db):
        expense = _fake_expense()
        mock_db.query.return_value.filter.return_value.first.return_value = expense
        client = make_test_client(router)
        r = client.patch(f"/expenses/{expense.id}", json={"valor": "6000.00"})
        assert r.status_code == 200
        assert expense.valor == Decimal("6000.00")
        # descricao must remain unchanged (not set by patch)
        assert expense.descricao == "Aluguel maio"

    def test_invalid_expense_id_returns_422(self, make_test_client, mock_db):
        client = make_test_client(router)
        r = client.patch("/expenses/not-a-uuid", json={"descricao": "X"})
        assert r.status_code == 422


# ── DELETE /expenses/{id} ─────────────────────────────────────────────────────

class TestDeleteExpense:

    def test_soft_deletes_and_returns_204(self, make_test_client, mock_db):
        expense = _fake_expense()
        mock_db.query.return_value.filter.return_value.first.return_value = expense
        client = make_test_client(router)
        r = client.delete(f"/expenses/{expense.id}")
        assert r.status_code == 204
        assert expense.deleted_at is not None
        mock_db.commit.assert_called_once()

    def test_not_found_returns_404(self, make_test_client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = None
        client = make_test_client(router)
        r = client.delete(f"/expenses/{uuid.uuid4()}")
        assert r.status_code == 404

    def test_no_auth_returns_401(self, mock_db):
        client = _no_auth_client(mock_db)
        r = client.delete(f"/expenses/{uuid.uuid4()}")
        assert r.status_code == 401

    def test_invalid_uuid_returns_422(self, make_test_client, mock_db):
        client = make_test_client(router)
        r = client.delete("/expenses/not-a-uuid")
        assert r.status_code == 422
