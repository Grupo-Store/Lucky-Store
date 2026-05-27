import uuid
import pytest
from unittest.mock import patch, MagicMock

from app.services.pagamento_pedido import PagamentoPedidoService
from app.schemas.pedido import FormaPagamentoIn
from app.utils.errors import NotFoundException


PEDIDO_ID = uuid.uuid4()
USER_ID = uuid.uuid4()


def test_add_payment_success(mock_db):
    """Verifica que db.add e db.commit são chamados quando tudo corre bem."""
    data = FormaPagamentoIn(forma="Cartão de Crédito")

    with patch("app.services.pagamento_pedido.PedidoService.get_by_id") as mock_get:
        mock_get.return_value = MagicMock()
        result = PagamentoPedidoService.add_payment_method(mock_db, PEDIDO_ID, data, USER_ID)

    mock_get.assert_called_once_with(mock_db, PEDIDO_ID)
    assert mock_db.add.called
    assert mock_db.commit.called
    assert mock_db.flush.called
    assert mock_db.refresh.called


def test_add_payment_pedido_not_found(mock_db):
    """Verifica que NotFoundException propaga quando o pedido não existe."""
    data = FormaPagamentoIn(forma="Boleto")

    with patch("app.services.pagamento_pedido.PedidoService.get_by_id") as mock_get:
        mock_get.side_effect = NotFoundException("Pedido não encontrado")

        with pytest.raises(NotFoundException):
            PagamentoPedidoService.add_payment_method(mock_db, PEDIDO_ID, data, USER_ID)

    mock_db.add.assert_not_called()
    mock_db.commit.assert_not_called()


def test_add_payment_forma_salva(mock_db):
    """Verifica que PedidoFormaPagamento é criado com o valor correto de `forma`."""
    forma_esperada = "Pix"
    data = FormaPagamentoIn(forma=forma_esperada)

    with patch("app.services.pagamento_pedido.PedidoService.get_by_id") as mock_get:
        mock_get.return_value = MagicMock()
        PagamentoPedidoService.add_payment_method(mock_db, PEDIDO_ID, data, USER_ID)

    # O primeiro add recebe o PedidoFormaPagamento
    primeiro_add_arg = mock_db.add.call_args_list[0][0][0]
    assert primeiro_add_arg.forma == forma_esperada
    assert primeiro_add_arg.id_pedido == PEDIDO_ID
