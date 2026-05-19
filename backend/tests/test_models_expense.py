"""Tests for the Expense SQLAlchemy model."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal


class TestExpenseModel:

    def test_tablename(self):
        from app.models.expense import Expense
        assert Expense.__tablename__ == "expenses"

    def test_instantiation_required_fields(self):
        from app.models.expense import Expense
        e = Expense(
            id_loja=uuid.uuid4(),
            descricao="Aluguel",
            valor=Decimal("5000.00"),
            data_prevista=date(2026, 5, 10),
        )
        assert e.descricao == "Aluguel"
        assert e.valor == Decimal("5000.00")
        assert e.data_prevista == date(2026, 5, 10)

    def test_optional_fields_default_to_none(self):
        from app.models.expense import Expense
        e = Expense(
            id_loja=uuid.uuid4(),
            descricao="Salário",
            valor=Decimal("3000.00"),
            data_prevista=date(2026, 5, 5),
        )
        assert e.data_paga is None
        assert e.parcelas is None
        assert e.deleted_at is None
        assert e.created_by is None

    def test_recorrente_defaults_false(self):
        from app.models.expense import Expense
        e = Expense(
            id_loja=uuid.uuid4(),
            descricao="Boleto",
            valor=Decimal("200.00"),
            data_prevista=date(2026, 5, 20),
        )
        assert e.recorrente is False or e.recorrente is None

    def test_repr(self):
        from app.models.expense import Expense
        e = Expense(descricao="Conta de luz", valor=Decimal("450.00"))
        assert "Conta de luz" in repr(e)
        assert "450.00" in repr(e)

    def test_full_instantiation(self):
        from app.models.expense import Expense
        eid = uuid.uuid4()
        loja_id = uuid.uuid4()
        user_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        e = Expense(
            id=eid,
            id_loja=loja_id,
            descricao="Aluguel maio",
            valor=Decimal("5000.00"),
            data_prevista=date(2026, 5, 10),
            data_paga=date(2026, 5, 8),
            recorrente=True,
            parcelas=None,
            created_by=user_id,
            created_at=now,
        )
        assert e.id == eid
        assert e.id_loja == loja_id
        assert e.recorrente is True
        assert e.data_paga == date(2026, 5, 8)

    def test_expense_in_models_init(self):
        from app.models import Expense
        assert Expense.__tablename__ == "expenses"
