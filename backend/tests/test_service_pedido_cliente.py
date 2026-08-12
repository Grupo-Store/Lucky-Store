"""
Testes da sincronização entre pedido e cadastro de clientes.

Cobre o cenário que motivou a mudança: editar o cliente num pedido existente
precisa refletir em `clientes`, senão o autocomplete continua sugerindo o valor
antigo.
"""
import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.services.pedido import PedidoService, _sync_cliente
from app.schemas.pedido import PedidoUpdate, PedidoCreate


def _fake_pedido(pedido_id=None, com_cliente=True):
    p = MagicMock()
    p.id = pedido_id or uuid.uuid4()
    p.status = "To Buy"
    p.numero_os = "OS-001"
    p.valor_venda = Decimal("500.00")
    p.custo = None
    p.deleted_at = None
    p.formas_pagamento = []
    if com_cliente:
        cliente = MagicMock()
        cliente.id = uuid.uuid4()
        cliente.nome = "Nome Antigo"
        cliente.empresa = "Empresa Antiga"
        cliente.cnpj = "12.345.678/0001-90"
        p.cliente = cliente
        p.id_cliente = cliente.id
    else:
        p.cliente = None
    return p


# ── _sync_cliente ─────────────────────────────────────────────────────────────

def test_sync_sem_dados_de_cliente_nao_faz_nada(mock_db):
    pedido = _fake_pedido()
    nome_original = pedido.cliente.nome

    with patch("app.services.pedido.upsert_cliente") as mock_upsert:
        _sync_cliente(mock_db, pedido, None, None, None)

    mock_upsert.assert_not_called()
    assert pedido.cliente.nome == nome_original


def test_sync_com_documento_faz_upsert_e_reaponta_pedido(mock_db):
    pedido = _fake_pedido()
    novo_cliente = MagicMock()
    novo_cliente.id = uuid.uuid4()

    with patch("app.services.pedido.upsert_cliente", return_value=novo_cliente) as mock_upsert:
        _sync_cliente(mock_db, pedido, "Contato", "98.765.432/0001-10", "Outra Empresa")

    mock_upsert.assert_called_once_with(mock_db, "Contato", "98.765.432/0001-10", "Outra Empresa")
    # Trocar o CPF/CNPJ significa outro cliente — o pedido tem que apontar pra ele
    assert pedido.id_cliente == novo_cliente.id


def test_sync_sem_documento_edita_cliente_vinculado(mock_db):
    """Corrigir só o nome não pode criar um cliente duplicado."""
    pedido = _fake_pedido()
    id_original = pedido.id_cliente

    with patch("app.services.pedido.upsert_cliente") as mock_upsert:
        _sync_cliente(mock_db, pedido, "Nome Corrigido", None, "Empresa Corrigida")

    mock_upsert.assert_not_called()
    assert pedido.cliente.nome == "Nome Corrigido"
    assert pedido.cliente.empresa == "Empresa Corrigida"
    assert pedido.id_cliente == id_original


def test_sync_sem_documento_e_sem_cliente_nao_quebra(mock_db):
    pedido = _fake_pedido(com_cliente=False)

    with patch("app.services.pedido.upsert_cliente") as mock_upsert:
        _sync_cliente(mock_db, pedido, "Contato", None, None)

    mock_upsert.assert_not_called()


def test_sync_ignora_campos_vazios(mock_db):
    pedido = _fake_pedido()

    _sync_cliente(mock_db, pedido, "Novo Nome", None, None)

    assert pedido.cliente.nome == "Novo Nome"
    assert pedido.cliente.empresa == "Empresa Antiga"  # preservado


# ── PedidoService.update ──────────────────────────────────────────────────────

def test_update_propaga_dados_do_cliente(mock_db):
    pedido_id = uuid.uuid4()
    pedido = _fake_pedido(pedido_id)
    data = PedidoUpdate(
        nome_cliente="Contato Novo",
        cpf_cnpj="98.765.432/0001-10",
        empresa_cliente="Empresa Nova",
    )

    novo_cliente = MagicMock()
    novo_cliente.id = uuid.uuid4()

    with patch.object(PedidoService, "get_by_id", return_value=pedido), \
         patch("app.services.pedido.upsert_cliente", return_value=novo_cliente) as mock_upsert:
        PedidoService.update(mock_db, pedido_id, data, uuid.uuid4())

    mock_upsert.assert_called_once()
    assert pedido.id_cliente == novo_cliente.id


def test_update_nao_seta_campos_de_cliente_no_pedido(mock_db):
    """Os campos de cliente são consumidos pelo _sync_cliente, não viram
    atributos soltos no objeto Pedido."""
    pedido_id = uuid.uuid4()
    pedido = _fake_pedido(pedido_id)
    data = PedidoUpdate(nome_cliente="Contato", cpf_cnpj="12.345.678/0001-90",
                        empresa_cliente="Empresa", observacao="nota")

    with patch.object(PedidoService, "get_by_id", return_value=pedido), \
         patch("app.services.pedido.upsert_cliente", return_value=MagicMock()):
        PedidoService.update(mock_db, pedido_id, data, uuid.uuid4())

    # observacao é campo real do pedido e deve ter sido aplicado
    assert pedido.observacao == "nota"
    # os de cliente não pertencem à tabela pedidos
    for campo in ("nome_cliente", "cpf_cnpj", "empresa_cliente"):
        assert campo not in pedido.__dict__


def test_update_sem_dados_de_cliente_preserva_cadastro(mock_db):
    pedido_id = uuid.uuid4()
    pedido = _fake_pedido(pedido_id)
    data = PedidoUpdate(observacao="só mudou a observação")

    with patch.object(PedidoService, "get_by_id", return_value=pedido), \
         patch("app.services.pedido.upsert_cliente") as mock_upsert:
        PedidoService.update(mock_db, pedido_id, data, uuid.uuid4())

    mock_upsert.assert_not_called()
    assert pedido.cliente.nome == "Nome Antigo"


# ── PedidoService.create ──────────────────────────────────────────────────────

def test_create_grava_empresa_do_cliente(mock_db):
    data = PedidoCreate(
        id_loja=uuid.uuid4(),
        id_vendedor=uuid.uuid4(),
        nome_cliente="Contato",
        cpf_cnpj="12.345.678/0001-90",
        empresa_cliente="Tech Solutions Ltda",
        data_pedido=date.today(),
        data_entrega=date.today(),
        status="To Buy",
        formas_pagamento=[],
    )

    cliente = MagicMock()
    cliente.id = uuid.uuid4()

    with patch("app.services.pedido._generate_numero_os", return_value="OS-001"), \
         patch("app.services.pedido.Pedido", return_value=_fake_pedido()), \
         patch("app.services.pedido.upsert_cliente", return_value=cliente) as mock_upsert:
        PedidoService.create(mock_db, data, uuid.uuid4())

    assert mock_upsert.call_args.args[3] == "Tech Solutions Ltda"
