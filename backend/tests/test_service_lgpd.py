"""
Tests for app.services.lgpd — LgpdService.delete_user_data.
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, call

import pytest

from app.services.lgpd import LgpdService
from app.models.audit_log import AuditAction, AuditLog as AuditLogModel


def _fake_user(user_id=None):
    user = MagicMock()
    user.id = user_id or uuid.uuid4()
    user.email = "john@example.com"
    user.name = "John Doe"
    user.password_hash = "hashed"
    user.totp_secret = "SECRET"
    user.totp_enabled = True
    user.is_active = True
    user.deleted_at = None
    return user


class TestDeleteUserData:

    def test_anonymizes_email_and_name(self, mock_db):
        user_id = uuid.uuid4()
        requesting_id = uuid.uuid4()
        user = _fake_user(user_id)
        mock_db.query.return_value.filter.return_value.first.return_value = user

        result = LgpdService.delete_user_data(mock_db, user_id, requesting_id)

        assert result["deleted"] is True
        assert "anonimizado.invalid" in user.email
        assert user.name == "Usuário Removido"

    def test_clears_sensitive_fields(self, mock_db):
        user_id = uuid.uuid4()
        requesting_id = uuid.uuid4()
        user = _fake_user(user_id)
        mock_db.query.return_value.filter.return_value.first.return_value = user

        LgpdService.delete_user_data(mock_db, user_id, requesting_id)

        assert user.password_hash == ""
        assert user.totp_secret is None
        assert user.totp_enabled is False

    def test_sets_is_active_false_and_deleted_at(self, mock_db):
        user_id = uuid.uuid4()
        requesting_id = uuid.uuid4()
        user = _fake_user(user_id)
        mock_db.query.return_value.filter.return_value.first.return_value = user

        LgpdService.delete_user_data(mock_db, user_id, requesting_id)

        assert user.is_active is False
        assert user.deleted_at is not None

    def test_creates_audit_log_with_delete_action(self, mock_db):
        user_id = uuid.uuid4()
        requesting_id = uuid.uuid4()
        user = _fake_user(user_id)
        mock_db.query.return_value.filter.return_value.first.return_value = user

        LgpdService.delete_user_data(mock_db, user_id, requesting_id)

        added = [c.args[0] for c in mock_db.add.call_args_list]
        audit_entries = [o for o in added if isinstance(o, AuditLogModel)]
        assert len(audit_entries) == 1
        log = audit_entries[0]
        assert log.action == AuditAction.DELETE
        assert log.entity_type == "user"
        assert log.changed_by == requesting_id

    def test_audit_log_old_values_contains_original_email(self, mock_db):
        user_id = uuid.uuid4()
        requesting_id = uuid.uuid4()
        user = _fake_user(user_id)
        original_email = user.email
        mock_db.query.return_value.filter.return_value.first.return_value = user

        LgpdService.delete_user_data(mock_db, user_id, requesting_id)

        added = [c.args[0] for c in mock_db.add.call_args_list]
        log = next(o for o in added if isinstance(o, AuditLogModel))
        assert log.old_values["email"] == original_email

    def test_user_not_found_returns_deleted_false(self, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = LgpdService.delete_user_data(mock_db, uuid.uuid4(), uuid.uuid4())

        assert result["deleted"] is False
        mock_db.commit.assert_not_called()

    def test_anonymized_email_contains_user_id_prefix(self, mock_db):
        user_id = uuid.uuid4()
        user = _fake_user(user_id)
        mock_db.query.return_value.filter.return_value.first.return_value = user

        LgpdService.delete_user_data(mock_db, user_id, uuid.uuid4())

        assert str(user_id)[:8] in user.email

    def test_commits_after_all_changes(self, mock_db):
        user_id = uuid.uuid4()
        user = _fake_user(user_id)
        mock_db.query.return_value.filter.return_value.first.return_value = user

        LgpdService.delete_user_data(mock_db, user_id, uuid.uuid4())

        mock_db.commit.assert_called_once()
