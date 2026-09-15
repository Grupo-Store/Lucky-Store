"""Real transaction checks in disposable schemas on an explicitly set test DB."""
import os
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session

import app.models  # Register all related tables.
from app.database import Base
from app.models import User, Loja, Vendedor, Cliente, Cotacao, ItemCotacao, Pedido, Produto, Frete, CustoPedido
from app.schemas.cotacao import CotacaoUpdate
from app.schemas.pedido import PedidoUpdate, PedidoCreate
from app.services.cotacao import CotacaoService
from app.services.pedido import PedidoService


@pytest.fixture
def records():
    url = os.environ.get('TEST_MIGRATION_DATABASE_URL')
    if not url:
        pytest.skip('Requires an explicit disposable PostgreSQL test database')
    engine = create_engine(url)
    with engine.connect() as conn:
        outer = conn.begin()
        schema = 'test_save_' + uuid4().hex
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        conn.execute(text(f'SET LOCAL search_path TO "{schema}"'))
        Base.metadata.create_all(conn)
        with Session(bind=conn, autoflush=False, join_transaction_mode='create_savepoint') as db:
            user = User(id=uuid4(), email='local@example.com', name='Local', password_hash='fake')
            loja = Loja(id=uuid4(), nome='Lucky Store')
            cliente = Cliente(id=uuid4(), nome='Cliente')
            db.add_all([user, loja, cliente]); db.flush()
            vendor = Vendedor(id=uuid4(), id_loja=loja.id, nome='Local')
            db.add(vendor); db.flush()
            quote = Cotacao(id=uuid4(), id_loja=loja.id, id_vendedor=vendor.id,
                            cliente='Cliente', data_cotacao=date.today(), created_by=user.id)
            order = Pedido(id=uuid4(), id_loja=loja.id, id_vendedor=vendor.id, id_cliente=cliente.id,
                           numero_os='123', data_pedido=date.today(), data_entrega=date.today(),
                           status='To Buy', created_by=user.id, multa=100, juros=50,
                           num_parcelas_efetivas=3, data_pagamento=date.today())
            db.add_all([quote, order]); db.flush()
            qi = ItemCotacao(id=uuid4(), id_cotacao=quote.id, descricao='Original', quantidade=1, valor_unitario=100)
            pi = Produto(id=uuid4(), id_pedido=order.id, id_vendedor=vendor.id, descricao='Original',
                         quantidade=1, valor_projetado=50, valor_venda=100, observacao='Preservar',
                         fornecedor='Fornecedor', sub_compras=[{'value': 12}], status='Bought')
            freight = Frete(id=uuid4(), id_pedido=order.id, valor=20, data_frete=date.today(), pago=True)
            db.add_all([qi, pi, freight, CustoPedido(id_pedido=order.id, custo_boleto=25)])
            db.commit()
            yield db, user.id, quote.id, order.id, qi.id, pi.id, freight.id, vendor.id, loja.id
        outer.rollback()
    engine.dispose()


def quote_item(item_id, **changes):
    return dict(id=item_id, descricao='Atualizado', quantidade=2, valor_unitario=150, **changes)


@pytest.mark.parametrize('selected_name', ['MARCOS', 'Marcos', 'marcos'])
def test_freight_payment_groups_case_variations_and_respects_period(records, selected_name):
    from app.services.fretes import FretesService
    db, _, _, order, _, _, freight_id, _, loja = records
    original = db.get(Frete, freight_id)
    original.entregador = ' MARCOS '
    original.pago = False
    original.data_frete = date(2026, 9, 10)
    others = [
        Frete(id_pedido=order, entregador='MARCOS', valor=10, data_frete=date(2026, 9, 12), pago=False),
        Frete(id_pedido=order, entregador='Marcos', valor=13, data_frete=date(2026, 9, 12), pago=False),
        Frete(id_pedido=order, entregador='MARCOS', valor=17, data_frete=date(2026, 8, 12), pago=False),
        Frete(id_pedido=order, entregador='MARCOS', valor=19, data_frete=date(2026, 9, 12), pago=True),
        Frete(id_pedido=order, entregador=' marcos ', valor=5, data_frete=date(2026, 9, 12), pago=False),
        Frete(id_pedido=order, entregador='Rafael', valor=6, data_frete=date(2026, 9, 12), pago=False),
    ]
    db.add_all(others); db.commit()
    filters = dict(id_loja=loja, data_inicio=date(2026, 9, 1), data_fim=date(2026, 9, 30))
    before = FretesService.get_summary(db, **filters)
    assert before['entregadores_ativos'] == 2
    grouped = next(row for row in before['por_entregador'] if row['entregador'] == 'MARCOS')
    assert grouped == dict(entregador='MARCOS', qtd_entregas=5, valor_total=Decimal('67'), a_pagar=Decimal('48'),
                           valor_pago=Decimal('19'), pendentes=4, pagos=1)
    assert len(FretesService.get_detail(db, entregador=selected_name, **filters)['items']) == 5
    assert FretesService.confirm_payment(db, selected_name, **filters) == {'confirmados': 4}
    db.expire_all()
    assert original.pago and all(others[i].pago for i in [0, 1, 3, 4])
    assert not others[2].pago and not others[5].pago
    after = FretesService.get_summary(db, **filters)
    assert after['valor_total'] == before['valor_total']
    assert after['a_pagar'] == before['a_pagar'] - Decimal('48')
    assert next(row for row in after['por_entregador'] if row['entregador'] == 'MARCOS')['a_pagar'] == 0
    assert FretesService.confirm_payment(db, 'MARCOS', **filters) == {'confirmados': 0}


def test_freight_payment_supports_unnamed_rows_and_excludes_cancelled_orders(records):
    from app.services.fretes import FretesService
    db, _, _, order, _, _, freight_id, *_ = records
    original = db.get(Frete, freight_id)
    original.entregador = None
    original.pago = False
    blank = Frete(id_pedido=order, entregador='   ', valor=15, data_frete=date.today(), pago=False)
    db.add(blank); db.commit()
    assert len(FretesService.get_detail(db, entregador='—')['items']) == 2
    assert FretesService.confirm_payment(db, '—') == {'confirmados': 2}
    original.pago = False
    db.get(Pedido, order).status = 'Cancelled'
    db.commit()
    assert FretesService.confirm_payment(db, '—') == {'confirmados': 0}
    assert original.pago is False


def order_item(item_id, vendor_id, **changes):
    result = dict(id=item_id, id_vendedor=vendor_id, descricao='Atualizado', quantidade=2, valor_projetado=50)
    result.update(changes)
    return result


def test_partial_freight_payment_persists_survives_os_edit_and_can_be_undone(records):
    from app.services.fretes import FretesService
    db, user, _, order, _, _, freight_id, *_ = records
    freight = db.get(Frete, freight_id)
    freight.entregador = 'Rafael'
    freight.valor = 30
    freight.pago = False
    db.commit()
    FretesService.confirm_payment(db, 'RAFAEL', valor=Decimal('10'))
    db.expire_all()
    assert freight.valor_pago == 10 and not freight.pago
    row = FretesService.get_summary(db)['por_entregador'][0]
    assert row['valor_total'] == 30 and row['valor_pago'] == 10 and row['a_pagar'] == 20
    PedidoService.update(db, order, PedidoUpdate(fretes=[dict(
        id=freight_id, entregador='Rafael', valor=30, data_frete=date.today(), pago=False,
    )]), user)
    db.expire_all()
    assert freight.valor_pago == 10
    FretesService.confirm_payment(db, 'rafael', valor=Decimal('5'), desfazer=True)
    assert freight.valor_pago == 5
    FretesService.confirm_payment(db, 'rafael', valor=Decimal('25'))
    assert freight.pago and freight.valor_pago == 30
    FretesService.confirm_payment(db, 'rafael', valor=Decimal('30'), desfazer=True)
    assert not freight.pago and freight.valor_pago == 0


def test_partial_payment_allocates_across_freights_and_rejects_excess(records):
    from app.services.fretes import FretesService
    db, _, _, order, _, _, freight_id, *_ = records
    first = db.get(Frete, freight_id)
    first.entregador = 'Marcos'; first.pago = False; first.data_frete = date(2026, 9, 1)
    second = Frete(id_pedido=order, entregador='MARCOS', valor=30, data_frete=date(2026, 9, 2), pago=False)
    db.add(second); db.commit()
    FretesService.confirm_payment(db, 'marcos', valor=Decimal('25'))
    assert first.valor_pago == 20 and first.pago
    assert second.valor_pago == 5 and not second.pago
    with pytest.raises(ValueError):
        FretesService.confirm_payment(db, 'Marcos', valor=Decimal('26'))
    db.expire_all()
    assert first.valor_pago == 20 and second.valor_pago == 5
    FretesService.confirm_payment(db, 'marcos', valor=Decimal('10'), desfazer=True)
    assert second.valor_pago == 0 and first.valor_pago == 15


def test_legacy_zero_value_freight_can_be_unpaid(records):
    from app.services.fretes import FretesService
    db, _, _, _, _, _, freight_id, *_ = records
    freight = db.get(Frete, freight_id)
    freight.entregador = 'Rafael'; freight.valor = 0; freight.pago = True
    db.commit()
    row = FretesService.get_summary(db)['por_entregador'][0]
    assert row['pagos'] == 1 and row['pendentes'] == 0
    FretesService.confirm_payment(db, 'rafael', valor=Decimal('0'), desfazer=True)
    assert not freight.pago
    assert FretesService.get_summary(db)['por_entregador'][0]['pendentes'] == 1


def test_quote_edit_preserves_ids_and_retry_does_not_duplicate(records):
    db, user, quote, _, old, *_ = records
    new_id = uuid4()
    payload = CotacaoUpdate(cliente='Novo cliente', itens=[quote_item(old), quote_item(new_id)],
                            fase={'status_enviada': True})
    for _ in range(2):
        result = CotacaoService.update(db, quote, payload, user)
        assert {item.id for item in result.itens} == {old, new_id}
        assert result.status_enviada is True
    assert db.get(ItemCotacao, old).descricao == 'Atualizado'


def test_quote_failure_rolls_back_parent_deletions_and_insertions(records):
    db, user, quote, _, old, *_ = records
    with pytest.raises(DataError):
        CotacaoService.update(db, quote, CotacaoUpdate(cliente='Nao salvar', itens=[
            dict(id=uuid4(), descricao='Overflow', quantidade=1, valor_unitario=Decimal('1e30')),
        ]), user)
    db.rollback()
    assert db.get(Cotacao, quote).cliente == 'Cliente'
    assert db.get(ItemCotacao, old).descricao == 'Original'
    assert db.query(ItemCotacao).count() == 1


def test_order_edit_keeps_metadata_and_clears_payment_fields(records):
    db, user, _, order, _, item, freight, vendor, _ = records
    result = PedidoService.update(db, order, PedidoUpdate(
        itens=[order_item(item, vendor, valor_venda=0, valor_compra=0)],
        multa=0, juros=0, num_parcelas_efetivas=1, data_pagamento=None,
        plano_parcelas=[], plano_parcelas_pedido=[],
    ), user)
    saved = db.get(Produto, item)
    assert saved.descricao == 'Atualizado'
    assert saved.valor_venda == 0
    assert saved.fornecedor == 'Fornecedor' and saved.observacao == 'Preservar'
    assert saved.sub_compras == [{'value': 12}] and saved.status == 'Bought'
    assert result.multa == result.juros == 0 and result.num_parcelas_efetivas == 1
    assert result.data_pagamento is None and result.plano_parcelas == []
    assert result.custo.custo_boleto == 25
    assert db.get(Frete, freight).pago is True


def test_order_failure_rolls_back_items_freight_and_costs(records):
    db, user, _, order, _, item, freight, vendor, _ = records
    with pytest.raises(DataError):
        PedidoService.update(db, order, PedidoUpdate(
            observacao='Nao salvar', custo={'custo_boleto': 0}, fretes=[],
            itens=[order_item(uuid4(), vendor, valor_venda=Decimal('1e30'))],
        ), user)
    db.rollback()
    assert db.get(Produto, item).descricao == 'Original'
    assert db.get(Frete, freight).pago is True
    assert db.get(Pedido, order).custo.custo_boleto == 25
    assert db.get(Pedido, order).observacao is None


def test_order_retry_keeps_added_items_and_freight_once(records):
    db, user, _, order, _, item, _, vendor, _ = records
    added, freight = uuid4(), uuid4()
    payload = PedidoUpdate(itens=[order_item(item, vendor), order_item(added, vendor)],
                           fretes=[dict(id=freight, valor=20, data_frete=date.today(), pago=True)])
    for _ in range(2):
        result = PedidoService.update(db, order, payload, user)
        assert {p.id for p in result.produtos} == {item, added}
        assert [f.id for f in result.fretes] == [freight]


def test_order_create_failure_does_not_leave_empty_order(records):
    db, user, _, _, _, _, _, _, loja = records
    vendor = db.query(Vendedor).first().id
    with pytest.raises(IntegrityError):
        PedidoService.create(db, PedidoCreate(
            id_loja=loja, id_vendedor=vendor, nome_cliente='Cliente', numero_os='456',
            data_pedido=date.today(), data_entrega=date.today(),
            itens=[order_item(uuid4(), uuid4())],
        ), user)
    db.rollback()
    assert db.query(Pedido).count() == 1


def test_child_cannot_be_moved_from_another_parent(records):
    db, user, quote, _, old, *_ = records
    other = Cotacao(id=uuid4(), id_loja=db.get(Cotacao, quote).id_loja,
                   id_vendedor=db.get(Cotacao, quote).id_vendedor,
                   cliente='Outro', data_cotacao=date.today(), created_by=user)
    db.add(other); db.commit()
    with pytest.raises(ValueError, match='outro registro'):
        CotacaoService.update(db, other.id, CotacaoUpdate(itens=[quote_item(old)]), user)
    db.rollback()
    assert db.get(ItemCotacao, old).id_cotacao == quote


def test_order_creation_saves_all_children_once_with_schema_defaults(records):
    db, user, _, _, _, _, _, vendor, loja = records
    item, freight = uuid4(), uuid4()
    payload = PedidoCreate(
        id_loja=loja, id_vendedor=vendor, nome_cliente='Cliente', numero_os='456',
        data_pedido=date.today(), data_entrega=date.today(),
        itens=[order_item(item, vendor, is_direct_supply=True)],
        fretes=[dict(id=freight, valor=30, data_frete=date.today(), pago=True)],
    )
    first = PedidoService.create(db, payload, user, idempotency_key='same-save')
    second = PedidoService.create(db, payload, user, idempotency_key='same-save')
    assert first.id == second.id
    assert db.query(Produto).filter(Produto.id_pedido == first.id).count() == 1
    assert db.get(Produto, item).status == 'To Buy'
    assert db.get(Produto, item).is_direct_supply is True
    assert db.get(Frete, freight).pago is True


def test_quote_omitted_items_preserves_them_and_explicit_empty_list_removes(records):
    db, user, quote, _, item, *_ = records
    CotacaoService.update(db, quote, CotacaoUpdate(observacao='Só anotação'), user)
    assert db.get(ItemCotacao, item) is not None
    CotacaoService.update(db, quote, CotacaoUpdate(itens=[]), user)
    assert db.get(ItemCotacao, item) is None
