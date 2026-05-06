"""
Tests for ip_address / user_agent capture in PedidoService audit logs.
"""
import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch, ANY

import pytest

from app.models.audit_log import AuditAction, AuditLog as AuditLogModel


def _fake_pedido(pedido_id=None):
    p = MagicMock()
    p.id = pedido_id or uuid.uuid4()
    p.status = "To Buy"
    p.numero_os = "OS-001"
    p.valor_venda = Decimal("500.00")
    p.custo = None
    p.deleted_at = None
    return p


class TestPedidoAuditIpCapture:

    def test_create_passes_ip_and_ua_to_audit_log(self, mock_db):
        from app.services.pedido import PedidoService
        from app.schemas.pedido import PedidoCreate

        user_id = uuid.uuid4()
        data = PedidoCreate(
            id_loja=uuid.uuid4(),
            id_vendedor=uuid.uuid4(),
            id_cliente=uuid.uuid4(),
            data_pedido=date.today(),
            data_entrega=date.today(),
            status="To Buy",
            formas_pagamento=[],
        )

        fake_pedido = _fake_pedido()
        mock_db.flush.return_value = None
        mock_db.refresh.side_effect = lambda obj: None

        with patch("app.services.pedido._generate_numero_os", return_value="OS-001"), \
             patch("app.services.pedido.Pedido", return_value=fake_pedido):
            PedidoService.create(
                mock_db, data, user_id,
                ip_address="192.168.1.1", user_agent="TestAgent/1.0",
            )

        added = [c.args[0] for c in mock_db.add.call_args_list]
        audit_entries = [o for o in added if isinstance(o, AuditLogModel)]
        assert len(audit_entries) == 1
        assert audit_entries[0].ip_address == "192.168.1.1"
        assert audit_entries[0].user_agent == "TestAgent/1.0"

    def test_update_passes_ip_and_ua_to_audit_log(self, mock_db):
        from app.services.pedido import PedidoService
        from app.schemas.pedido import PedidoUpdate

        pedido_id = uuid.uuid4()
        user_id = uuid.uuid4()
        fake_pedido = _fake_pedido(pedido_id)
        data = PedidoUpdate(observacao="updated")

        with patch.object(PedidoService, "get_by_id", return_value=fake_pedido):
            PedidoService.update(
                mock_db, pedido_id, data, user_id,
                ip_address="10.0.0.1", user_agent="Mozilla/5.0",
            )

        added = [c.args[0] for c in mock_db.add.call_args_list]
        audit_entries = [o for o in added if isinstance(o, AuditLogModel)]
        assert any(
            log.ip_address == "10.0.0.1" and log.user_agent == "Mozilla/5.0"
            for log in audit_entries
        )

    def test_change_status_passes_ip_and_ua(self, mock_db):
        from app.services.pedido import PedidoService

        pedido_id = uuid.uuid4()
        user_id = uuid.uuid4()
        fake_pedido = _fake_pedido(pedido_id)

        with patch.object(PedidoService, "get_by_id", return_value=fake_pedido):
            PedidoService.change_status(
                mock_db, pedido_id, "Delivered", user_id,
                ip_address="172.16.0.1", user_agent="curl/7.0",
            )

        added = [c.args[0] for c in mock_db.add.call_args_list]
        audit_entries = [o for o in added if isinstance(o, AuditLogModel)]
        assert any(
            log.ip_address == "172.16.0.1" and log.user_agent == "curl/7.0"
            for log in audit_entries
        )

    def test_soft_delete_passes_ip_and_ua(self, mock_db):
        from app.services.pedido import PedidoService

        pedido_id = uuid.uuid4()
        user_id = uuid.uuid4()
        fake_pedido = _fake_pedido(pedido_id)

        mock_db.query.return_value.filter.return_value.first.return_value = None  # no RMA

        with patch.object(PedidoService, "get_by_id", return_value=fake_pedido):
            PedidoService.soft_delete(
                mock_db, pedido_id, user_id,
                ip_address="1.2.3.4", user_agent="DeleteAgent",
            )

        added = [c.args[0] for c in mock_db.add.call_args_list]
        audit_entries = [o for o in added if isinstance(o, AuditLogModel)]
        assert any(
            log.ip_address == "1.2.3.4" and log.user_agent == "DeleteAgent"
            for log in audit_entries
        )

    def test_ip_ua_optional_defaults_to_none(self, mock_db):
        from app.services.pedido import PedidoService
        from app.schemas.pedido import PedidoUpdate

        pedido_id = uuid.uuid4()
        user_id = uuid.uuid4()
        fake_pedido = _fake_pedido(pedido_id)
        data = PedidoUpdate(observacao="no ip test")

        with patch.object(PedidoService, "get_by_id", return_value=fake_pedido):
            PedidoService.update(mock_db, pedido_id, data, user_id)

        added = [c.args[0] for c in mock_db.add.call_args_list]
        audit_entries = [o for o in added if isinstance(o, AuditLogModel)]
        assert all(log.ip_address is None for log in audit_entries)
        assert all(log.user_agent is None for log in audit_entries)
