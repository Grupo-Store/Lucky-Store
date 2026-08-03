"""Tests for Expense Pydantic schemas."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest


class TestExpenseCreate:

    def test_valid_minimal(self):
        from app.schemas.expense import ExpenseCreate
        s = ExpenseCreate(
            descricao="Aluguel",
            valor=Decimal("5000.00"),
            data_prevista=date(2026, 5, 10),
            id_loja=uuid.uuid4(),
        )
        assert s.descricao == "Aluguel"
        assert s.recorrente is False
        assert s.data_paga is None
        assert s.parcelas is None

    def test_valid_full(self):
        from app.schemas.expense import ExpenseCreate
        loja_id = uuid.uuid4()
        s = ExpenseCreate(
            descricao="Salário",
            valor=Decimal("8000.00"),
            data_prevista=date(2026, 5, 5),
            data_paga=date(2026, 5, 4),
            recorrente=True,
            id_loja=loja_id,
            parcelas=3,
        )
        assert s.recorrente is True
        assert s.data_paga == date(2026, 5, 4)
        assert s.parcelas == 3
        assert s.id_loja == loja_id

    def test_missing_required_field_raises(self):
        from app.schemas.expense import ExpenseCreate
        with pytest.raises(Exception):
            ExpenseCreate(valor=Decimal("100.00"), data_prevista=date(2026, 5, 1), id_loja=uuid.uuid4())

    def test_valor_must_be_numeric(self):
        from app.schemas.expense import ExpenseCreate
        with pytest.raises(Exception):
            ExpenseCreate(
                descricao="X",
                valor="not-a-number",
                data_prevista=date(2026, 5, 1),
                id_loja=uuid.uuid4(),
            )


class TestExpenseUpdate:

    def test_all_fields_optional(self):
        from app.schemas.expense import ExpenseUpdate
        u = ExpenseUpdate()
        assert u.descricao is None
        assert u.valor is None
        assert u.data_paga is None

    def test_partial_update_descricao(self):
        from app.schemas.expense import ExpenseUpdate
        u = ExpenseUpdate(descricao="Novo nome")
        assert u.descricao == "Novo nome"
        assert u.valor is None

    def test_partial_update_data_paga(self):
        from app.schemas.expense import ExpenseUpdate
        u = ExpenseUpdate(data_paga=date(2026, 5, 15))
        assert u.data_paga == date(2026, 5, 15)

    def test_model_dump_exclude_unset(self):
        from app.schemas.expense import ExpenseUpdate
        u = ExpenseUpdate(data_paga=date(2026, 5, 15))
        dumped = u.model_dump(exclude_unset=True)
        assert "data_paga" in dumped
        assert "descricao" not in dumped
        assert "valor" not in dumped


class TestExpenseResponse:

    def test_from_attributes(self):
        from app.schemas.expense import ExpenseResponse
        from unittest.mock import MagicMock
        obj = MagicMock()
        obj.id = uuid.uuid4()
        obj.id_loja = uuid.uuid4()
        obj.descricao = "Conta de água"
        obj.valor = Decimal("150.00")
        obj.data_prevista = date(2026, 5, 12)
        obj.data_paga = None
        obj.recorrente = False
        obj.parcelas = None
        obj.created_by = uuid.uuid4()
        obj.created_at = datetime.now(timezone.utc)
        obj.deleted_at = None
        r = ExpenseResponse.model_validate(obj)
        assert r.descricao == "Conta de água"
        assert r.data_paga is None

    def test_pago_serialization(self):
        from app.schemas.expense import ExpenseResponse
        from unittest.mock import MagicMock
        obj = MagicMock()
        obj.id = uuid.uuid4()
        obj.id_loja = uuid.uuid4()
        obj.descricao = "Salário"
        obj.valor = Decimal("6000.00")
        obj.data_prevista = date(2026, 5, 5)
        obj.data_paga = date(2026, 5, 3)
        obj.recorrente = True
        obj.parcelas = None
        obj.created_by = uuid.uuid4()
        obj.created_at = datetime.now(timezone.utc)
        obj.deleted_at = None
        r = ExpenseResponse.model_validate(obj)
        assert r.data_paga == date(2026, 5, 3)


class TestExpenseListResponse:

    def test_structure(self):
        from app.schemas.expense import ExpenseListResponse
        resp = ExpenseListResponse(items=[], total=0, page=1, limit=20)
        assert resp.items == []
        assert resp.total == 0
        assert resp.page == 1
        assert resp.limit == 20
