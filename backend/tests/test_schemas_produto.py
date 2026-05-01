import pytest
from decimal import Decimal
from uuid import uuid4
from pydantic import ValidationError
from app.schemas.produto import ProdutoCreate, ProdutoStatusUpdate


def _base_create(**overrides):
    data = dict(
        id_vendedor=uuid4(),
        descricao="Produto teste",
        quantidade=1,
        valor_projetado=Decimal("100.00"),
    )
    data.update(overrides)
    return data


def test_status_update_valid():
    obj = ProdutoStatusUpdate(new_status="Pending")
    assert obj.new_status == "Pending"


def test_status_update_invalid():
    with pytest.raises(ValidationError):
        ProdutoStatusUpdate(new_status="INVALIDO")


def test_create_quantidade_zero():
    with pytest.raises(ValidationError):
        ProdutoCreate(**_base_create(quantidade=0))


def test_create_valor_projetado_negativo():
    with pytest.raises(ValidationError):
        ProdutoCreate(**_base_create(valor_projetado=Decimal("-1")))


def test_create_valid():
    obj = ProdutoCreate(**_base_create())
    assert obj.quantidade == 1
    assert obj.valor_projetado == Decimal("100.00")


def test_create_all_statuses_valid():
    from app.models.produto import PRODUTO_STATUSES
    for s in PRODUTO_STATUSES:
        obj = ProdutoStatusUpdate(new_status=s)
        assert obj.new_status == s
