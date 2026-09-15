from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.pedido import Frete, Pedido, PEDIDO_ATIVO
from app.services.frete_payment import paid_amount


class FretesService:
    @staticmethod
    def _entregador_key():
        return func.coalesce(func.nullif(func.trim(Frete.entregador), ""), "—")

    @staticmethod
    def _filter_entregador(query, entregador):
        # Summary, details and payment share the same case-insensitive grouping.
        return query.filter(func.lower(FretesService._entregador_key()) == (entregador.strip() or "—").lower())

    @staticmethod
    def confirm_payment(db: Session, entregador: str, id_loja=None, data_inicio=None, data_fim=None,
                        valor=None, desfazer=False):
        query = FretesService._apply_filters(
            FretesService._base_query(db), id_loja, data_inicio, data_fim
        )
        query = FretesService._filter_entregador(query, entregador)
        try:
            rows = query.order_by(Frete.data_frete, Frete.id).with_for_update(of=Frete).all()
            available = sum((paid_amount(f) if desfazer else Decimal(str(f.valor)) - paid_amount(f)
                             for f, _ in rows), Decimal('0'))
            amount = available if valor is None else Decimal(str(valor))
            if amount < 0 or amount > available or (amount == 0 and available > 0):
                raise ValueError('Informe um valor maior que zero e até o saldo disponível.')
            remaining = amount
            changed = 0
            # Pay oldest freights first; undo in reverse order.
            if desfazer:
                rows.reverse()
            for frete, _pedido in rows:
                total = Decimal(str(frete.valor))
                old_paid = paid_amount(frete)
                delta = min(remaining, old_paid if desfazer else total - old_paid)
                if delta == 0 and (total != 0 or frete.pago == (not desfazer)):
                    continue
                frete.valor_pago = old_paid - delta if desfazer else old_paid + delta
                frete.pago = (frete.valor_pago >= total) if total > 0 else not desfazer
                remaining -= delta
                changed += 1
            db.commit()
        except Exception:
            db.rollback()
            raise
        return {"confirmados": changed}

    @staticmethod
    def _base_query(db: Session):
        return (
            db.query(Frete, Pedido)
            .join(Pedido, Frete.id_pedido == Pedido.id)
            .filter(Pedido.deleted_at.is_(None))
            .filter(PEDIDO_ATIVO)
            .filter(Frete.id_pedido.isnot(None))
        )

    @staticmethod
    def _apply_filters(query, id_loja, data_inicio, data_fim):
        if id_loja:
            query = query.filter(Pedido.id_loja == id_loja)
        if data_inicio:
            query = query.filter(Frete.data_frete >= data_inicio)
        if data_fim:
            query = query.filter(Frete.data_frete <= data_fim)
        return query

    @staticmethod
    def get_summary(
        db: Session,
        id_loja: Optional[UUID] = None,
        data_inicio: Optional[date] = None,
        data_fim: Optional[date] = None,
    ) -> dict:
        query = FretesService._apply_filters(
            FretesService._base_query(db), id_loja, data_inicio, data_fim
        )
        rows = query.all()

        agg: dict = defaultdict(
            lambda: {"nome": None, "qtd": 0, "total": Decimal("0"), "a_pagar": Decimal("0"),
                     "valor_pago": Decimal("0"), "pendentes": 0, "pagos": 0}
        )
        for frete, _pedido in rows:
            name = (frete.entregador or "").strip() or "—"
            key = name.lower()
            # Pick a stable spelling from the saved names without rewriting them.
            agg[key]["nome"] = min(agg[key]["nome"] or name, name)
            agg[key]["qtd"] += 1
            agg[key]["total"] += Decimal(str(frete.valor))
            agg[key]["valor_pago"] += paid_amount(frete)
            agg[key]["a_pagar"] += Decimal(str(frete.valor)) - paid_amount(frete)
            agg[key]["pendentes"] += int(not frete.pago)
            agg[key]["pagos"] += int(frete.pago or paid_amount(frete) > 0)

        por_entregador = sorted(
            [
                {
                    "entregador": v["nome"],
                    "qtd_entregas": v["qtd"],
                    "valor_total": v["total"],
                    "a_pagar": v["a_pagar"],
                    "valor_pago": v["valor_pago"],
                    "pendentes": v["pendentes"],
                    "pagos": v["pagos"],
                }
                for k, v in agg.items()
            ],
            key=lambda x: x["valor_total"],
            reverse=True,
        )

        valor_total = sum((e["valor_total"] for e in por_entregador), Decimal("0"))
        a_pagar = sum((e["a_pagar"] for e in por_entregador), Decimal("0"))

        return {
            "total_entregas": len(rows),
            "entregadores_ativos": len(por_entregador),
            "valor_total": valor_total,
            "a_pagar": a_pagar,
            "por_entregador": por_entregador,
        }

    @staticmethod
    def get_detail(
        db: Session,
        entregador: Optional[str] = None,
        id_loja: Optional[UUID] = None,
        data_inicio: Optional[date] = None,
        data_fim: Optional[date] = None,
    ) -> dict:
        query = FretesService._apply_filters(
            FretesService._base_query(db), id_loja, data_inicio, data_fim
        )
        if entregador is not None:
            query = FretesService._filter_entregador(query, entregador)

        rows = query.order_by(Frete.data_frete.desc()).all()

        items = [
            {
                "id": frete.id,
                "id_pedido": pedido.id,
                "numero_os": pedido.numero_os,
                "nome_cliente": pedido.cliente.nome if pedido.cliente else None,
                "entregador": (frete.entregador or "").strip() or "—",
                "data_frete": frete.data_frete,
                "valor": Decimal(str(frete.valor)),
                "pago": frete.pago,
                "valor_pago": paid_amount(frete),
            }
            for frete, pedido in rows
        ]

        return {"items": items}
