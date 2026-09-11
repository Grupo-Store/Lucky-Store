from decimal import Decimal
from datetime import date
import json
import os
from pathlib import Path
from uuid import uuid4

import pytest

from app.models import Cotacao, ItemCotacao, Pedido, Produto
from app.services.conversao_cotacao import ConversaoCotacaoService
from tests.test_atomic_saves_postgres import records


@pytest.mark.parametrize('extra_freight', [0, 20])
def test_create_complete_read_and_save_again_preserves_financial_data(records, extra_freight):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes.pedidos import router
    from app.core.dependencies import get_current_user
    from app.database import get_db
    from app.models import User

    db, user_id, quote_id, _, _, _, _, vendor_id, store_id = records
    quote = db.get(Cotacao, quote_id)
    quote.numero = 86
    quote.cliente = 'Adriano'
    quote.b2b_company = 'Hospital Jayme da Fonte'
    quote.forma_pagamento = 'Pix'
    quote.garantia = '12 meses'
    db.commit()
    user = db.get(User, user_id)
    app = FastAPI()
    @app.middleware('http')
    async def local_client_address(request, call_next):
        # TestClient otherwise sends "testclient", which is not a PostgreSQL INET.
        request.scope['client'] = ('127.0.0.1', 12345)
        return await call_next(request)

    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    today = date.today().isoformat()
    item_id = str(uuid4())
    payload = {
        'id_loja': str(store_id), 'id_vendedor': str(vendor_id), 'id_cotacao': str(quote_id),
        'nome_cliente': 'Hospital Jayme da Fonte', 'contato_cliente': 'Adriano',
        'numero_oc': '0131146', 'data_pedido': today, 'data_entrega': today,
        'valor_venda': '2058', 'status': 'To Buy', 'is_direct_billing': True,
        'formas_pagamento': [],
        'custo': {'custo_produto_inicial': '913.5', 'custo_produto_final': '913.5',
                  'custo_boleto': '0', 'brinde': '0', 'pct_custo_credito': '0', 'custo_credito': '0',
                  'pct_custo_debito': '0', 'custo_debito': '0', 'pct_imposto_compra': '0',
                  'imposto_compra': '0', 'pct_imposto_venda': '0', 'imposto_venda': '0'},
        'itens': [{'id': item_id, 'id_vendedor': str(vendor_id), 'descricao': 'OFFICE PRO PLUS 21',
                   'quantidade': 3, 'valor_projetado': 304.5, 'preco_custo': 304.5,
                   'valor_compra': 686, 'is_direct_supply': True, 'fornecedor': 'TECHFORM',
                   'porcentagem_fornecedor': '10', 'frete_fornecedor': '20', 'nota_fiscal_item': ''}],
        'fretes': ([{'id': str(uuid4()), 'valor': extra_freight, 'data_frete': today,
                     'entregador': 'Entrega ao cliente', 'pago': False}] if extra_freight else []),
    }
    with TestClient(app) as client:
        created = client.post('/pedidos/complete', json=payload)
        assert created.status_code == 201, created.text
        order_id = created.json()['id']
        order_number = created.json()['numero_os']
        for save_again in (False, True):
            if save_again:
                saved = client.put(f'/pedidos/{order_id}/complete', json=payload)
                assert saved.status_code == 200, saved.text
            db.expire_all()
            listed = client.get('/pedidos', params={'numero_os': order_number})
            assert listed.status_code == 200, listed.text
            record = next(row for row in listed.json()['items'] if row['id'] == order_id)
            assert record['numero_cotacao'] == 86
            assert record['contato_cliente'] == 'Adriano'
            assert record['nome_cliente'] == 'Hospital Jayme da Fonte'
            assert record['numero_oc'] == '0131146'
            assert record['termos_cotacao']['garantia'] == '12 meses'
            assert Decimal(record['valor_venda']) == 2058
            assert Decimal(record['custo']['custo_produto_final']) == Decimal('913.50')
            assert Decimal(record['custo']['custo_produto_inicial']) == Decimal('913.50')
            assert len(record['produtos']) == 1
            product = record['produtos'][0]
            assert product['id'] == item_id
            assert Decimal(product['preco_custo']) == Decimal('304.50')
            assert Decimal(product['valor_compra']) == 686
            assert product['quantidade'] == 3
            assert Decimal(product['frete_fornecedor']) == 20
            assert sum(Decimal(f['valor']) for f in record['fretes']) == extra_freight
            assert len(record['fretes']) == (1 if extra_freight else 0)

        # Optional bridge: the frontend test reopens this actual HTTP response.
        contract_dir = os.environ.get('DIRECT_SUPPLY_CONTRACT_DIR')
        if contract_dir:
            folder = Path(contract_dir)
            folder.mkdir(parents=True, exist_ok=True)
            (folder / f'order-freight-{extra_freight}.json').write_text(json.dumps(record), encoding='utf-8')


def test_conversion_preserves_direct_supply_cost_and_sale_after_reload(records):
    db, user, quote_id, _, quote_item_id, *_ = records
    quote = db.get(Cotacao, quote_id)
    quote.is_direct_billing = True
    quote.valor_total = 2058
    item = db.get(ItemCotacao, quote_item_id)
    item.descricao = 'OFFICE PRO PLUS 21'
    item.quantidade = 3
    item.valor_unitario = Decimal('304.50')
    item.valor_fechamento = Decimal('686.00')
    item.is_direct_supply = True
    item.fornecedor = 'TECHFORM'
    item.porcentagem_fornecedor = 10
    item.frete_fornecedor = 20
    db.commit()

    order_id = ConversaoCotacaoService.convert_to_pedido(db, quote_id, user).id
    db.expire_all()
    order = db.get(Pedido, order_id)
    product = db.query(Produto).filter(Produto.id_pedido == order_id).one()
    assert order.valor_venda == 2058
    assert order.custo.custo_produto_inicial == order.custo.custo_produto_final == Decimal('913.50')
    assert product.preco_custo == Decimal('304.50')
    assert product.valor_compra == product.valor_venda == Decimal('686.00')
    assert product.fornecedor == 'TECHFORM'
    supplier_share = ((product.valor_compra - product.preco_custo) * product.quantidade
                      * product.porcentagem_fornecedor / 100 + product.frete_fornecedor)
    assert supplier_share == Decimal('134.45')
    assert order.valor_venda - order.custo.custo_produto_final - supplier_share == Decimal('1010.05')


def test_mixed_conversion_does_not_mark_regular_estimates_as_purchases(records):
    db, user, quote_id, _, quote_item_id, *_ = records
    regular = db.get(ItemCotacao, quote_item_id)
    regular.quantidade = 2
    regular.valor_unitario = 100
    regular.valor_fechamento = 150
    db.add(ItemCotacao(id=uuid4(), id_cotacao=quote_id, descricao='Direto', quantidade=3,
                      valor_unitario=50, valor_fechamento=80, is_direct_supply=True))
    db.commit()
    order_id = ConversaoCotacaoService.convert_to_pedido(db, quote_id, user).id
    db.expire_all()
    order = db.get(Pedido, order_id)
    assert order.is_direct_billing is True
    assert order.valor_venda == 540
    assert order.custo.custo_produto_inicial == 350
    assert order.custo.custo_produto_final == 150
    regular_product = next(p for p in order.produtos if not p.is_direct_supply)
    assert regular_product.valor_compra is None
    assert regular_product.preco_custo is None
