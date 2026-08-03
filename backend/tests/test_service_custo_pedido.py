"""
Tests for app.services.custo_pedido — CustoPedidoService and _calculate_financials.
"""
import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch, call

import pytest

from app.services.custo_pedido import _calculate_financials, CustoPedidoService
from app.schemas.pedido import CustoPedidoIn
from app.utils.errors import BusinessLogicException, NotFoundException


# ── helpers ──────────────────────────────────────────────────────────────────

def _mock_custo(**kwargs):
    custo = MagicMock()
    defaults = {f: None for f in [
        "custo_produto_final", "custo_servico", "brinde",
        "imposto_compra", "imposto_venda", "custo_credito",
        "custo_debito", "custo_boleto",
    ]}
    defaults.update(kwargs)
    for k, v in defaults.items():
        setattr(custo, k, v)
    return custo


def _custo_pedido_in(**kwargs) -> CustoPedidoIn:
    defaults = dict(
        custo_produto_inicial=None,
        custo_produto_final=None,
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
    )
    defaults.update(kwargs)
    return CustoPedidoIn(**defaults)


# ── _calculate_financials ─────────────────────────────────────────────────────

class TestCalculateFinancials:

    def test_all_fields_sum_correctly_excludes_produto_inicial(self):
        """Soma apenas os 8 campos corretos; custo_produto_inicial é ignorado."""
        custo = _mock_custo(
            custo_produto_final=Decimal("100.00"),
            custo_servico=Decimal("20.00"),
            brinde=Decimal("5.00"),
            imposto_compra=Decimal("10.00"),
            imposto_venda=Decimal("8.00"),
            custo_credito=Decimal("3.00"),
            custo_debito=Decimal("2.00"),
            custo_boleto=Decimal("1.50"),
        )
        # custo_produto_inicial is NOT an attribute of _mock_custo intentionally
        valor_venda = Decimal("200.00")
        result = _calculate_financials(custo, valor_venda)

        expected_custo_total = Decimal("149.50")
        assert result.custo_total == expected_custo_total
        assert result.lucro_liquido == valor_venda - expected_custo_total
        # Escala 0–1, igual à `margem` do dashboard: (200 - 149.50) / 200 = 0.2525
        assert result.margem_bruta_pct == Decimal("0.2525")

    def test_valor_venda_none_returns_no_lucro_or_margem(self):
        """Sem valor de venda não é possível calcular lucro nem margem."""
        custo = _mock_custo(custo_produto_final=Decimal("50.00"))
        result = _calculate_financials(custo, None)

        assert result.custo_total == Decimal("50.00")
        assert result.lucro_liquido is None
        assert result.margem_bruta_pct is None

    def test_valor_venda_zero_margem_is_none(self):
        """valor_venda=0 evita divisão por zero — margem deve ser None."""
        custo = _mock_custo(custo_produto_final=Decimal("10.00"))
        result = _calculate_financials(custo, Decimal("0"))

        assert result.lucro_liquido == Decimal("-10.00")
        assert result.margem_bruta_pct is None

    def test_none_fields_treated_as_zero(self):
        """Todos os campos None somam 0."""
        custo = _mock_custo()  # todos None
        result = _calculate_financials(custo, Decimal("100.00"))

        assert result.custo_total == Decimal("0")
        assert result.lucro_liquido == Decimal("100.00")
        # 100% de margem na escala 0–1
        assert result.margem_bruta_pct == Decimal("1.0000")

    def test_margem_quantized_to_four_decimal_places(self):
        """Margem é quantizada em 4 casas na escala 0–1 (= 2 casas em pontos percentuais)."""
        # custo_total = 1, valor_venda = 3 → (3 - 1) / 3 = 0.6666... → 0.6667
        custo = _mock_custo(custo_produto_final=Decimal("1"))
        result = _calculate_financials(custo, Decimal("3"))

        assert result.margem_bruta_pct == Decimal("0.6667")

    def test_margem_usa_a_mesma_escala_do_dashboard(self):
        """Regressão: dashboard devolve 0–1; esta função devolvia 0–100.

        Misturar as duas fontes exibia "2500%" na interface.
        """
        custo = _mock_custo(custo_produto_final=Decimal("750"))
        result = _calculate_financials(custo, Decimal("1000"))

        # 25% de margem → 0.25 e NÃO 25
        assert result.margem_bruta_pct == Decimal("0.2500")
        assert result.margem_bruta_pct < Decimal("1")


# ── CustoPedidoService.create_costs ──────────────────────────────────────────

def _fake_custo_out(custo_id=None):
    """Build a minimal CustoPedidoOut-compatible dict."""
    from app.schemas.pedido import CustoPedidoOut
    return CustoPedidoOut(
        id=custo_id or uuid.uuid4(),
        custo_produto_inicial=None,
        custo_produto_final=Decimal("99.00"),
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
    )


def _make_numeric_custo_mock(custo_produto_final=Decimal("99.00")):
    """MagicMock for CustoPedido with proper Decimal attributes for _calculate_financials."""
    custo = MagicMock()
    custo.id = uuid.uuid4()
    custo.custo_produto_final = custo_produto_final
    custo.custo_servico = None
    custo.brinde = None
    custo.imposto_compra = None
    custo.imposto_venda = None
    custo.custo_credito = None
    custo.custo_debito = None
    custo.custo_boleto = None
    return custo


class TestCreateCosts:

    def test_happy_path_calls_db_add_and_commit(self, mock_db):
        """create_costs deve persistir o custo e o audit log e fazer commit."""
        pedido_id = uuid.uuid4()
        user_id = uuid.uuid4()
        data = _custo_pedido_in(custo_produto_final=Decimal("99.00"))

        # No existing custo on first query
        mock_db.query.return_value.filter.return_value.first.return_value = None

        fake_pedido = MagicMock()
        fake_pedido.valor_venda = Decimal("200.00")

        # After db.refresh the custo object must have proper Decimal fields
        refreshed_custo = _make_numeric_custo_mock()

        def _refresh(obj):
            # Copy attributes from refreshed_custo into obj so model_validate works
            obj.id = refreshed_custo.id
            obj.custo_produto_final = refreshed_custo.custo_produto_final
            obj.custo_servico = refreshed_custo.custo_servico
            obj.brinde = refreshed_custo.brinde
            obj.imposto_compra = refreshed_custo.imposto_compra
            obj.imposto_venda = refreshed_custo.imposto_venda
            obj.custo_credito = refreshed_custo.custo_credito
            obj.custo_debito = refreshed_custo.custo_debito
            obj.custo_boleto = refreshed_custo.custo_boleto
            obj.custo_produto_inicial = None
            obj.pct_imposto_compra = None
            obj.pct_imposto_venda = None
            obj.pct_custo_credito = None
            obj.pct_custo_debito = None

        mock_db.refresh.side_effect = _refresh

        with patch("app.services.custo_pedido.PedidoService.get_by_id", return_value=fake_pedido):
            result = CustoPedidoService.create_costs(mock_db, pedido_id, data, user_id)

        # db.add called at least twice (CustoPedido + AuditLog)
        assert mock_db.add.call_count >= 2
        mock_db.flush.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

        # Result carries financials
        assert result.financials is not None
        assert result.financials.custo_total == Decimal("99.00")

    def test_existing_custo_raises_business_logic_exception(self, mock_db):
        """Se já existe um custo para o pedido, deve lançar BusinessLogicException."""
        pedido_id = uuid.uuid4()
        user_id = uuid.uuid4()
        data = _custo_pedido_in()

        # Simulate existing custo
        mock_db.query.return_value.filter.return_value.first.return_value = MagicMock()

        fake_pedido = MagicMock()
        fake_pedido.valor_venda = Decimal("100.00")

        with patch("app.services.custo_pedido.PedidoService.get_by_id", return_value=fake_pedido):
            with pytest.raises(BusinessLogicException) as exc_info:
                CustoPedidoService.create_costs(mock_db, pedido_id, data, user_id)

        assert "já possui custos" in exc_info.value.detail


# ── CustoPedidoService.update_costs ──────────────────────────────────────────

class TestUpdateCosts:

    def test_happy_path_updates_fields_and_commits(self, mock_db):
        """update_costs deve atualizar atributos do custo existente e commitar."""
        pedido_id = uuid.uuid4()
        user_id = uuid.uuid4()
        data = _custo_pedido_in(
            custo_produto_final=Decimal("150.00"),
            custo_servico=Decimal("30.00"),
        )

        fake_custo = _make_numeric_custo_mock(custo_produto_final=Decimal("150.00"))
        mock_db.query.return_value.filter.return_value.first.return_value = fake_custo

        fake_pedido = MagicMock()
        fake_pedido.valor_venda = Decimal("300.00")

        def _refresh(obj):
            # Ensure Decimal attrs stay after refresh
            obj.id = fake_custo.id
            obj.custo_produto_final = Decimal("150.00")
            obj.custo_servico = Decimal("30.00")
            obj.brinde = None
            obj.imposto_compra = None
            obj.imposto_venda = None
            obj.custo_credito = None
            obj.custo_debito = None
            obj.custo_boleto = None
            obj.custo_produto_inicial = None
            obj.pct_imposto_compra = None
            obj.pct_imposto_venda = None
            obj.pct_custo_credito = None
            obj.pct_custo_debito = None

        mock_db.refresh.side_effect = _refresh

        with patch("app.services.custo_pedido.PedidoService.get_by_id", return_value=fake_pedido):
            result = CustoPedidoService.update_costs(mock_db, pedido_id, data, user_id)

        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()
        assert result.financials is not None
        assert result.financials.custo_total == Decimal("180.00")

    def test_custo_not_found_raises_not_found_exception(self, mock_db):
        """Se não existe custo para o pedido, deve lançar NotFoundException."""
        pedido_id = uuid.uuid4()
        user_id = uuid.uuid4()
        data = _custo_pedido_in()

        # No existing custo
        mock_db.query.return_value.filter.return_value.first.return_value = None

        fake_pedido = MagicMock()
        fake_pedido.valor_venda = Decimal("100.00")

        with patch("app.services.custo_pedido.PedidoService.get_by_id", return_value=fake_pedido):
            with pytest.raises(NotFoundException) as exc_info:
                CustoPedidoService.update_costs(mock_db, pedido_id, data, user_id)

        assert "Use POST para criar" in exc_info.value.detail

    def test_update_costs_adds_audit_log(self, mock_db):
        """update_costs deve registrar um AuditLog com action=UPDATE."""
        from app.models.audit_log import AuditAction, AuditLog as AuditLogModel

        pedido_id = uuid.uuid4()
        user_id = uuid.uuid4()
        data = _custo_pedido_in(custo_produto_final=Decimal("50.00"))

        fake_custo = _make_numeric_custo_mock(custo_produto_final=Decimal("50.00"))
        mock_db.query.return_value.filter.return_value.first.return_value = fake_custo

        fake_pedido = MagicMock()
        fake_pedido.valor_venda = Decimal("200.00")

        def _refresh(obj):
            obj.id = fake_custo.id
            obj.custo_produto_final = Decimal("50.00")
            obj.custo_servico = None
            obj.brinde = None
            obj.imposto_compra = None
            obj.imposto_venda = None
            obj.custo_credito = None
            obj.custo_debito = None
            obj.custo_boleto = None
            obj.custo_produto_inicial = None
            obj.pct_imposto_compra = None
            obj.pct_imposto_venda = None
            obj.pct_custo_credito = None
            obj.pct_custo_debito = None

        mock_db.refresh.side_effect = _refresh

        with patch("app.services.custo_pedido.PedidoService.get_by_id", return_value=fake_pedido):
            CustoPedidoService.update_costs(mock_db, pedido_id, data, user_id)

        # Verify that db.add was called with an AuditLog whose action is UPDATE
        added_objects = [c.args[0] for c in mock_db.add.call_args_list]
        audit_logs = [o for o in added_objects if isinstance(o, AuditLogModel)]
        assert any(log.action == AuditAction.UPDATE for log in audit_logs)
