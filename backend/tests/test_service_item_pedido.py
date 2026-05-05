import uuid
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch

from app.services.item_pedido import ItemPedidoService
from app.schemas.produto import ProdutoCreate
from app.utils.errors import NotFoundException


def _create_data(**overrides):
    data = dict(
        id_vendedor=uuid.uuid4(),
        descricao="Produto teste",
        quantidade=2,
        valor_projetado=Decimal("150.00"),
    )
    data.update(overrides)
    return ProdutoCreate(**data)


# ── _get_item ─────────────────────────────────────────────────────────────────

def test_get_item_not_found(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = None
    with pytest.raises(NotFoundException):
        ItemPedidoService._get_item(mock_db, uuid.uuid4(), uuid.uuid4())


def test_get_item_found(mock_db):
    fake_produto = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = fake_produto
    result = ItemPedidoService._get_item(mock_db, uuid.uuid4(), uuid.uuid4())
    assert result is fake_produto


# ── add_item ──────────────────────────────────────────────────────────────────

def test_add_item_success(mock_db):
    with patch("app.services.item_pedido.PedidoService.get_by_id") as mock_pedido:
        mock_pedido.return_value = MagicMock()
        pedido_id = uuid.uuid4()
        user_id = uuid.uuid4()
        result = ItemPedidoService.add_item(mock_db, pedido_id, _create_data(), user_id)
        mock_pedido.assert_called_once_with(mock_db, pedido_id)
        mock_db.add.assert_called()
        mock_db.commit.assert_called()


def test_add_item_pedido_not_found(mock_db):
    with patch("app.services.item_pedido.PedidoService.get_by_id") as mock_pedido:
        mock_pedido.side_effect = NotFoundException("Pedido não encontrado")
        with pytest.raises(NotFoundException):
            ItemPedidoService.add_item(mock_db, uuid.uuid4(), _create_data(), uuid.uuid4())


# ── update_item_status ────────────────────────────────────────────────────────

def test_update_status_success(mock_db):
    fake_produto = MagicMock()
    fake_produto.status = "Pending"
    mock_db.query.return_value.filter.return_value.first.return_value = fake_produto

    result = ItemPedidoService.update_item_status(
        mock_db, uuid.uuid4(), uuid.uuid4(), "Received", uuid.uuid4()
    )
    assert fake_produto.status == "Received"
    mock_db.commit.assert_called()


def test_update_status_item_not_found(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = None
    with pytest.raises(NotFoundException):
        ItemPedidoService.update_item_status(
            mock_db, uuid.uuid4(), uuid.uuid4(), "Received", uuid.uuid4()
        )


# ── remove_item ───────────────────────────────────────────────────────────────

def test_remove_item_success(mock_db):
    fake_produto = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = fake_produto

    ItemPedidoService.remove_item(mock_db, uuid.uuid4(), uuid.uuid4(), uuid.uuid4())
    mock_db.delete.assert_called_once_with(fake_produto)
    mock_db.commit.assert_called()


def test_remove_item_not_found(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = None
    with pytest.raises(NotFoundException):
        ItemPedidoService.remove_item(mock_db, uuid.uuid4(), uuid.uuid4(), uuid.uuid4())
