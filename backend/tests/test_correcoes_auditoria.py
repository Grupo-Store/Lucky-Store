"""Regressão para as correções apontadas na auditoria.

Cobre:
  1. change_status — validação de VALID_TRANSITIONS
  2. rma.close() — respeita a máquina de estados
  3. _derive_rma_status_from_items — ESTORNO deriva para REEMBOLSO
  4. _economia — usa os mesmos 8 campos de _calculate_financials
  5. _default_data_entrega — pedido convertido não nasce atrasado
  6. margem — escala 0–1 consistente com o dashboard
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.models.rma import RmaStatus
from app.models.item_rma import ItemRmaStatus
from app.schemas.pedido import VALID_TRANSITIONS
from app.utils.errors import BusinessLogicException


# ── 1. Transições de status do pedido ────────────────────────────────────────

def _fake_pedido(status: str):
    return SimpleNamespace(
        id=uuid.uuid4(), numero_os="OS-001", status=status,
        valor_venda=Decimal("100"), custo=None, is_cancelled=False,
    )


class TestChangeStatusTransicoes:

    def _call(self, status_atual: str, novo_status: str):
        from app.services.pedido import PedidoService
        db = MagicMock()
        pedido = _fake_pedido(status_atual)
        with patch.object(PedidoService, "get_by_id", return_value=pedido):
            PedidoService.change_status(db, pedido.id, novo_status, uuid.uuid4())
        return pedido

    def test_transicao_valida_e_aceita(self):
        pedido = self._call("To Buy", "Bought")
        assert pedido.status == "Bought"

    def test_salto_invalido_e_rejeitado(self):
        with pytest.raises(BusinessLogicException, match="Transição de status inválida"):
            self._call("To Buy", "Delivered")

    def test_status_terminal_nao_volta_atras(self):
        with pytest.raises(BusinessLogicException):
            self._call("Cancelled", "Bought")

    def test_delivered_e_terminal(self):
        with pytest.raises(BusinessLogicException):
            self._call("Delivered", "To Buy")

    def test_cancelar_e_permitido_de_quase_todo_lugar(self):
        for origem in ["To Buy", "Bought", "Received", "To Invoice", "To Pack"]:
            pedido = self._call(origem, "Cancelled")
            assert pedido.status == "Cancelled"
            assert pedido.is_cancelled is True

    def test_reentrar_no_mesmo_status_e_permitido(self):
        """A UI reenvia o status atual em salvamentos sem troca de fase."""
        pedido = self._call("Delivered", "Delivered")
        assert pedido.status == "Delivered"

    def test_mensagem_de_erro_lista_as_transicoes_permitidas(self):
        with pytest.raises(BusinessLogicException) as exc:
            self._call("To Buy", "Delivered")
        assert "Bought" in str(exc.value)
        assert "Cancelled" in str(exc.value)

    def test_todo_status_valido_tem_entrada_no_mapa(self):
        from app.schemas.pedido import VALID_STATUSES
        for s in VALID_STATUSES:
            assert s in VALID_TRANSITIONS


# ── 2. RMA close() respeita a máquina de estados ─────────────────────────────

def _fake_rma(status: RmaStatus):
    return SimpleNamespace(id=uuid.uuid4(), status=status, numero_rma="RMA-1-1")


class TestRmaClose:

    def _call(self, status: RmaStatus):
        from app.services.rma import RmaService
        db = MagicMock()
        rma = _fake_rma(status)
        with patch.object(RmaService, "get_by_id", return_value=rma):
            RmaService.close(db, rma.id, uuid.uuid4())
        return rma

    def test_fecha_a_partir_de_delivered(self):
        rma = self._call(RmaStatus.DELIVERED)
        assert rma.status == RmaStatus.COMPLETED

    def test_nao_fecha_a_partir_de_registered(self):
        with pytest.raises(BusinessLogicException, match="Transição inválida"):
            self._call(RmaStatus.REGISTERED)

    def test_nao_fecha_a_partir_de_in_repair(self):
        with pytest.raises(BusinessLogicException):
            self._call(RmaStatus.IN_REPAIR)

    def test_nao_fecha_rma_ja_concluido(self):
        with pytest.raises(BusinessLogicException, match="já está concluído"):
            self._call(RmaStatus.COMPLETED)

    def test_nao_fecha_rma_cancelado(self):
        with pytest.raises(BusinessLogicException, match="cancelado"):
            self._call(RmaStatus.CANCELLED)

    def test_nao_fecha_rma_reembolsado(self):
        """REEMBOLSO é terminal — COMPLETED não está entre suas transições."""
        with pytest.raises(BusinessLogicException):
            self._call(RmaStatus.REEMBOLSO)


# ── 3. Derivação de status do RMA a partir dos itens ─────────────────────────

def _item(status: ItemRmaStatus):
    return SimpleNamespace(status=status)


class TestDeriveRmaStatus:

    def _derive(self, *statuses):
        from app.services.rma import _derive_rma_status_from_items
        return _derive_rma_status_from_items([_item(s) for s in statuses])

    def test_todos_estornados_derivam_para_reembolso(self):
        """Antes retornava DELIVERED porque min_level >= 9 capturava o caso."""
        assert self._derive(ItemRmaStatus.ESTORNO, ItemRmaStatus.ESTORNO) == RmaStatus.REEMBOLSO

    def test_um_item_estornado_isolado_tambem_deriva_reembolso(self):
        assert self._derive(ItemRmaStatus.ESTORNO) == RmaStatus.REEMBOLSO

    def test_estorno_parcial_nao_vira_reembolso(self):
        """Com um item ainda entregue (nível 9), o mínimo não alcança ESTORNO."""
        assert self._derive(ItemRmaStatus.ESTORNO, ItemRmaStatus.DELIVERED) == RmaStatus.DELIVERED

    def test_todos_entregues_derivam_para_delivered(self):
        assert self._derive(ItemRmaStatus.DELIVERED, ItemRmaStatus.DELIVERED) == RmaStatus.DELIVERED

    def test_lista_vazia_retorna_none(self):
        assert self._derive() is None

    def test_itens_no_inicio_do_fluxo_nao_derivam_nada(self):
        assert self._derive(ItemRmaStatus.NOT_RECEIVED, ItemRmaStatus.RECEIVED) is None

    def test_qualquer_item_em_reparo_deriva_in_repair(self):
        assert self._derive(ItemRmaStatus.NOT_RECEIVED, ItemRmaStatus.IN_REPAIR) == RmaStatus.IN_REPAIR


# ── 4. _economia soma o mesmo conjunto de _calculate_financials ──────────────

def _custo(**kw):
    campos = dict(
        custo_produto_final=None, custo_servico=None, brinde=None,
        imposto_compra=None, imposto_venda=None,
        custo_credito=None, custo_debito=None, custo_boleto=None,
    )
    campos.update(kw)
    return SimpleNamespace(**campos)


class TestEconomia:

    def test_soma_os_oito_campos_e_nao_apenas_dois(self):
        from app.services.pedido import _economia
        pedido = SimpleNamespace(
            valor_venda=Decimal("200.00"),
            custo=_custo(
                custo_produto_final=Decimal("100.00"), custo_servico=Decimal("20.00"),
                brinde=Decimal("5.00"), imposto_compra=Decimal("10.00"),
                imposto_venda=Decimal("8.00"), custo_credito=Decimal("3.00"),
                custo_debito=Decimal("2.00"), custo_boleto=Decimal("1.50"),
            ),
        )
        # 200 − 149.50 = 50.50 (antes ignorava 29.50 e devolvia 80.00)
        assert _economia(pedido) == Decimal("50.50")

    def test_bate_com_calculate_financials(self):
        from app.services.pedido import _economia
        from app.services.custo_pedido import _calculate_financials
        custo = _custo(
            custo_produto_final=Decimal("100"), custo_servico=Decimal("20"),
            imposto_venda=Decimal("30"), custo_boleto=Decimal("5"),
        )
        venda = Decimal("500")
        pedido = SimpleNamespace(valor_venda=venda, custo=custo)
        # _calculate_financials também soma custo_servico do próprio objeto
        assert _economia(pedido) == _calculate_financials(custo, venda).lucro_liquido

    def test_campos_none_contam_como_zero(self):
        from app.services.pedido import _economia
        pedido = SimpleNamespace(valor_venda=Decimal("100"), custo=_custo())
        assert _economia(pedido) == Decimal("100")

    def test_sem_custo_retorna_none(self):
        from app.services.pedido import _economia
        assert _economia(SimpleNamespace(valor_venda=Decimal("100"), custo=None)) is None

    def test_sem_valor_venda_retorna_none(self):
        from app.services.pedido import _economia
        assert _economia(SimpleNamespace(valor_venda=None, custo=_custo())) is None


# ── 5. Data de entrega do pedido convertido de cotação ───────────────────────

class TestDataEntregaConversao:

    def test_data_futura_e_aproveitada(self):
        from app.services.conversao_cotacao import _default_data_entrega
        futura = date.today() + timedelta(days=10)
        assert _default_data_entrega(futura) == futura

    def test_data_passada_vira_prazo_padrao(self):
        """Antes copiava a data vencida e o pedido nascia com status Delayed."""
        from app.services.conversao_cotacao import _default_data_entrega
        passada = date.today() - timedelta(days=30)
        resultado = _default_data_entrega(passada)
        assert resultado > date.today()
        assert resultado == date.today() + timedelta(days=30)

    def test_data_none_vira_prazo_padrao(self):
        from app.services.conversao_cotacao import _default_data_entrega
        assert _default_data_entrega(None) == date.today() + timedelta(days=30)

    def test_data_de_hoje_e_aceita(self):
        from app.services.conversao_cotacao import _default_data_entrega
        assert _default_data_entrega(date.today()) == date.today()

    def test_resultado_nunca_esta_no_passado(self):
        from app.services.conversao_cotacao import _default_data_entrega
        for offset in [-365, -30, -1, 0, 1, 90]:
            assert _default_data_entrega(date.today() + timedelta(days=offset)) >= date.today()


# ── 6. Escala da margem ──────────────────────────────────────────────────────

class TestEscalaMargem:

    def test_margem_em_escala_zero_a_um(self):
        from app.services.custo_pedido import _calculate_financials
        r = _calculate_financials(_custo(custo_produto_final=Decimal("750")), Decimal("1000"))
        assert r.margem_bruta_pct == Decimal("0.2500")

    def test_margem_negativa_quando_ha_prejuizo(self):
        from app.services.custo_pedido import _calculate_financials
        r = _calculate_financials(_custo(custo_produto_final=Decimal("1500")), Decimal("1000"))
        assert r.margem_bruta_pct == Decimal("-0.5000")

    def test_venda_zero_nao_divide_por_zero(self):
        from app.services.custo_pedido import _calculate_financials
        r = _calculate_financials(_custo(custo_produto_final=Decimal("10")), Decimal("0"))
        assert r.margem_bruta_pct is None
