"""O custo de um item e o valor de compra UNITARIO vezes a quantidade.

Os tres campos de dinheiro da linha do item sao unitarios — valor projetado,
valor de compra e valor de venda — e cada total e o unitario vezes a quantidade.

O custo do pedido nao seguia essa regra: `valor_compra` entrava na soma sem
multiplicar, enquanto o item de fornecimento direto ao lado ja multiplicava. Um
item de 30 unidades compradas a R$170 lancava R$170 de custo no pedido, contra
um custo projetado de R$5.250 que ja vinha multiplicado — e era esse R$170 que
ia para o custo do pedido e para o dashboard.

Este arquivo nao precisa de banco: exercita a regra de soma direto.
"""
from decimal import Decimal

from app.services.product_cost import _total_comprado


class ProdutoFake:
    """So o que a regra le de um Produto."""

    def __init__(self, quantidade, valor_compra=None, preco_custo=None,
                 is_direct_supply=False, sub_compras=None):
        self.quantidade = quantidade
        self.valor_compra = valor_compra
        self.preco_custo = preco_custo
        self.is_direct_supply = is_direct_supply
        self.sub_compras = sub_compras


def test_valor_de_compra_multiplica_pela_quantidade():
    # O caso relatado: 30 unidades a R$170.
    item = ProdutoFake(quantidade=30, valor_compra=Decimal("170"))
    assert _total_comprado(item) == Decimal("5100")


def test_uma_unidade_continua_valendo_o_que_valia():
    item = ProdutoFake(quantidade=1, valor_compra=Decimal("170"))
    assert _total_comprado(item) == Decimal("170")


def test_item_sem_valor_de_compra_nao_custa_nada():
    item = ProdutoFake(quantidade=30, valor_compra=None)
    assert _total_comprado(item) == Decimal("0")


def test_sub_compra_multiplica_pela_quantidade_dela():
    # Uma compra de 30 unidades a R$170 = R$5.100.
    item = ProdutoFake(quantidade=30, valor_compra=Decimal("170"), sub_compras=[
        {"purchaseValue": 170, "selectedQuantity": 30},
    ])
    assert _total_comprado(item) == Decimal("5100")


def test_sub_compras_a_precos_diferentes_somam_cada_uma_pela_sua_quantidade():
    item = ProdutoFake(quantidade=30, valor_compra=Decimal("106.67"), sub_compras=[
        {"purchaseValue": 100, "selectedQuantity": 10},
        {"purchaseValue": 110, "selectedQuantity": 20},
    ])
    # 1.000 + 2.200. O valor_compra guardado (a media, R$106,67) nao entra na
    # conta justamente para o arredondamento dela nao virar custo.
    assert _total_comprado(item) == Decimal("3200")


def test_com_sub_compras_o_valor_compra_do_item_e_ignorado():
    item = ProdutoFake(quantidade=30, valor_compra=Decimal("999"), sub_compras=[
        {"purchaseValue": 170, "selectedQuantity": 30},
    ])
    assert _total_comprado(item) == Decimal("5100")


def test_fornecimento_direto_continua_pelo_preco_de_custo():
    item = ProdutoFake(quantidade=2, preco_custo=Decimal("50"), is_direct_supply=True)
    assert _total_comprado(item) == Decimal("100")


def test_sub_compra_torta_nao_derruba_a_soma():
    # JSONB e texto livre: o que nao for objeto com os dois campos e ignorado.
    item = ProdutoFake(quantidade=30, sub_compras=[
        {"purchaseValue": 170, "selectedQuantity": 30},
        "lixo",
        {"purchaseValue": None, "selectedQuantity": None},
    ])
    assert _total_comprado(item) == Decimal("5100")
