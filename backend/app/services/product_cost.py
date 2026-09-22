"""Keep the order's stored purchase cost in sync with its products."""
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog, AuditAction
from app.models.pedido import CustoPedido, Pedido
from app.models.produto import Produto


def _total_comprado(p: Produto) -> Decimal:
    """Quanto se pagou por este produto, no total.

    Os valores em dinheiro do item sao UNITARIOS — valor_projetado, valor_compra
    e valor_venda — e o total de cada um e o unitario vezes a quantidade. Dentro
    de cada sub-compra vale o mesmo: o valor e o de uma unidade e a quantidade
    dela e `selectedQuantity` (30 unidades a R$170 = R$5.100).

    valor_compra entrava aqui sem multiplicar, enquanto o fornecimento direto ao
    lado ja multiplicava. Um item de 30 unidades compradas a R$170 lancava R$170
    de custo no pedido, e era esse numero que ia para o dashboard.

    Com sub-compras a soma sai delas, e nao de valor_compra: precos diferentes
    na mesma compra nao cabem num unitario so, e valor_compra guarda ali apenas
    a media para exibicao.
    """
    if p.is_direct_supply:
        return (p.preco_custo or Decimal(0)) * p.quantidade

    subs = p.sub_compras or []
    if subs:
        total = Decimal(0)
        for sc in subs:
            if not isinstance(sc, dict):
                continue
            valor = Decimal(str(sc.get("purchaseValue") or 0))
            qtd = int(sc.get("selectedQuantity") or 0)
            total += valor * qtd
        return total

    return (p.valor_compra or Decimal(0)) * p.quantidade


def sync_product_cost(db: Session, pedido_id: UUID, user_id: UUID) -> None:
    # Serialize item saves for the same order before reading the new total.
    # The caller commits the item and its consolidated cost together.
    with db.no_autoflush:
        db.query(Pedido.id).filter(Pedido.id == pedido_id).with_for_update().first()
    db.flush()
    products = list(db.query(Produto).filter(
        Produto.id_pedido == pedido_id, Produto.deleted_at.is_(None),
    ).populate_existing().all())
    if not products:
        # Legacy orders without products may have a manually entered cost.
        return

    total = sum((_total_comprado(p) for p in products), Decimal(0)).quantize(Decimal('0.01'))
    cost = db.query(CustoPedido).filter(CustoPedido.id_pedido == pedido_id).populate_existing().first()
    created = cost is None
    if created:
        cost = CustoPedido(id_pedido=pedido_id)
        db.add(cost)
    old = {'custo_produto_final': str(cost.custo_produto_final), 'imposto_compra': str(cost.imposto_compra)}
    cost.custo_produto_final = total
    if cost.pct_imposto_compra is not None:
        cost.imposto_compra = (total * cost.pct_imposto_compra / 100).quantize(Decimal('0.01'))
    new = {'custo_produto_final': str(cost.custo_produto_final), 'imposto_compra': str(cost.imposto_compra)}
    if old != new:
        db.flush()
        db.add(AuditLog(entity_type='custo_pedido', entity_id=cost.id,
                        action=AuditAction.CREATE if created else AuditAction.UPDATE, changed_by=user_id,
                        old_values=old, new_values=new))
