"""
Tests for audit/LGPD routes:
  GET  /pedidos/{id}/history
  GET  /users/{id}/data-export
  DELETE /users/{id}/delete-data
"""
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.api.routes.pedidos import router as pedidos_router
from app.api.routes.users import router as users_router
from app.api.routes.auth import require_admin


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_status_history(entity_id):
    h = MagicMock()
    h.id = uuid.uuid4()
    h.entity_type = "pedido"
    h.entity_id = entity_id
    h.old_status = None
    h.new_status = "To Buy"
    h.changed_by = uuid.uuid4()
    h.changed_at = "2026-01-01T00:00:00+00:00"
    h.reason = "Criado"
    return h


def _make_audit_log(entity_type, entity_id):
    log = MagicMock()
    log.id = uuid.uuid4()
    log.entity_type = entity_type
    log.entity_id = entity_id
    log.action = "CREATE"
    log.changed_by = uuid.uuid4()
    log.changed_at = "2026-01-01T00:00:00+00:00"
    log.old_values = None
    log.new_values = {"status": "To Buy"}
    log.ip_address = "127.0.0.1"
    log.user_agent = "test"
    return log


def _make_user_mock(user_id):
    u = MagicMock()
    u.id = user_id
    u.email = "test@example.com"
    u.name = "Test User"
    u.role = "admin"
    u.is_active = True
    u.totp_enabled = False
    u.created_at = "2026-01-01T00:00:00+00:00"
    u.updated_at = "2026-01-01T00:00:00+00:00"
    u.deleted_at = None
    return u


# ── GET /pedidos/{id}/history ─────────────────────────────────────────────────

class TestGetOrderHistory:

    def test_returns_status_history_and_audit_logs(self, make_test_client, mock_db):
        client = make_test_client(pedidos_router)
        pedido_id = uuid.uuid4()

        status_mock = _make_status_history(pedido_id)
        audit_mock = _make_audit_log("pedido", pedido_id)

        def _query_side_effect(model):
            from app.models.status_history import StatusHistory
            from app.models.audit_log import AuditLog
            q = MagicMock()
            if model is StatusHistory:
                q.filter.return_value.order_by.return_value.all.return_value = [status_mock]
            elif model is AuditLog:
                q.filter.return_value.order_by.return_value.all.return_value = [audit_mock]
            else:
                q.filter.return_value.order_by.return_value.all.return_value = []
            return q

        mock_db.query.side_effect = _query_side_effect

        resp = client.get(f"/pedidos/{pedido_id}/history")

        assert resp.status_code == 200
        body = resp.json()
        assert "status_history" in body
        assert "audit_logs" in body
        assert len(body["status_history"]) == 1
        assert len(body["audit_logs"]) == 1

    def test_empty_history_returns_empty_arrays(self, make_test_client, mock_db):
        client = make_test_client(pedidos_router)
        pedido_id = uuid.uuid4()

        q = MagicMock()
        q.filter.return_value.order_by.return_value.all.return_value = []
        mock_db.query.return_value = q

        resp = client.get(f"/pedidos/{pedido_id}/history")

        assert resp.status_code == 200
        body = resp.json()
        assert body["status_history"] == []
        assert body["audit_logs"] == []

    def test_order_id_in_response(self, make_test_client, mock_db):
        client = make_test_client(pedidos_router)
        pedido_id = uuid.uuid4()

        q = MagicMock()
        q.filter.return_value.order_by.return_value.all.return_value = []
        mock_db.query.return_value = q

        resp = client.get(f"/pedidos/{pedido_id}/history")

        assert resp.json()["order_id"] == str(pedido_id)


# ── GET /users/{id}/data-export ───────────────────────────────────────────────

class TestExportUserData:

    def test_returns_user_and_audit_logs(self, make_test_client, mock_db):
        client = make_test_client(users_router)
        user_id = uuid.uuid4()
        fake_user = _make_user_mock(user_id)
        audit_mock = _make_audit_log("user", user_id)

        def _query_side_effect(model):
            from app.models.user import User
            from app.models.audit_log import AuditLog
            q = MagicMock()
            if model is User:
                q.filter.return_value.first.return_value = fake_user
            elif model is AuditLog:
                q.filter.return_value.order_by.return_value.all.return_value = [audit_mock]
            return q

        mock_db.query.side_effect = _query_side_effect

        resp = client.get(f"/users/{user_id}/data-export")

        assert resp.status_code == 200
        body = resp.json()
        assert "user" in body
        assert "audit_logs" in body
        assert len(body["audit_logs"]) == 1

    def test_user_not_found_returns_404(self, make_test_client, mock_db):
        client = make_test_client(users_router)
        user_id = uuid.uuid4()

        q = MagicMock()
        q.filter.return_value.first.return_value = None
        mock_db.query.return_value = q

        resp = client.get(f"/users/{user_id}/data-export")

        assert resp.status_code == 404


# ── DELETE /users/{id}/delete-data ───────────────────────────────────────────

class TestDeleteUserData:

    def test_successful_deletion_returns_deleted_true(self, make_test_client, mock_db, fake_user):
        from app.api.routes.auth import require_admin
        from fastapi.testclient import TestClient
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(users_router)
        app.dependency_overrides[require_admin] = lambda: fake_user
        from app.database import get_db
        from app.api.routes.auth import get_current_user_dep
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user_dep] = lambda: fake_user
        client = TestClient(app)

        target_id = uuid.uuid4()

        with patch("app.api.routes.users.LgpdService.delete_user_data",
                   return_value={"deleted": True, "user_id": str(target_id)}) as mock_delete:
            resp = client.delete(f"/users/{target_id}/delete-data")

        assert resp.status_code == 200
        assert resp.json()["deleted"] is True
        mock_delete.assert_called_once()

    def test_deletion_calls_lgpd_service_with_correct_ids(self, make_test_client, mock_db, fake_user):
        from fastapi.testclient import TestClient
        from fastapi import FastAPI
        from app.database import get_db
        from app.api.routes.auth import get_current_user_dep

        app = FastAPI()
        app.include_router(users_router)
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user_dep] = lambda: fake_user
        app.dependency_overrides[require_admin] = lambda: fake_user
        client = TestClient(app)

        target_id = uuid.uuid4()

        with patch("app.api.routes.users.LgpdService.delete_user_data",
                   return_value={"deleted": True, "user_id": str(target_id)}) as mock_delete:
            client.delete(f"/users/{target_id}/delete-data")

        call_kwargs = mock_delete.call_args
        assert call_kwargs.args[1] == target_id
        assert call_kwargs.args[2] == fake_user.id
