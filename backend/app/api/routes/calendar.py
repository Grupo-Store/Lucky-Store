from calendar import monthrange
from datetime import date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.expense import Expense
from app.models.pedido import Pedido
from app.models.user import User
from app.api.routes.auth import get_current_user_dep

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/entries")
def get_calendar_entries(
    ano: int = Query(...),
    mes: int = Query(..., ge=1, le=12),
    id_loja: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
) -> dict[str, list[dict[str, Any]]]:
    start = date(ano, mes, 1)
    end = date(ano, mes, monthrange(ano, mes)[1])

    result: dict[str, list[dict[str, Any]]] = {}

    def add_entry(d: date, entry: dict[str, Any]) -> None:
        key = d.isoformat()
        result.setdefault(key, []).append(entry)

    # Operational expenses
    expenses = (
        db.query(Expense)
        .filter(
            Expense.id_loja == id_loja,
            Expense.deleted_at.is_(None),
            Expense.data_prevista >= start,
            Expense.data_prevista <= end,
        )
        .all()
    )
    for e in expenses:
        add_entry(e.data_prevista, {
            "tipo": "expense",
            "id": str(e.id),
            "descricao": e.descricao,
            "valor": float(e.valor),
            "pago": e.data_paga is not None,
        })

    # Orders with data_pagamento in period — multa and juros
    pedidos_pagos = (
        db.query(Pedido)
        .filter(
            Pedido.id_loja == id_loja,
            Pedido.deleted_at.is_(None),
            Pedido.data_pagamento >= start,
            Pedido.data_pagamento <= end,
        )
        .all()
    )
    for p in pedidos_pagos:
        if p.multa:
            add_entry(p.data_pagamento, {
                "tipo": "multa",
                "id_pedido": str(p.id),
                "numero_os": p.numero_os,
                "valor": float(p.multa),
            })
        if p.juros:
            add_entry(p.data_pagamento, {
                "tipo": "juros",
                "id_pedido": str(p.id),
                "numero_os": p.numero_os,
                "valor": float(p.juros),
            })

    # Installment plans — each parcela has its own date
    pedidos_parcelados = (
        db.query(Pedido)
        .filter(
            Pedido.id_loja == id_loja,
            Pedido.deleted_at.is_(None),
            Pedido.plano_parcelas.isnot(None),
        )
        .all()
    )
    for p in pedidos_parcelados:
        if not p.plano_parcelas:
            continue
        total = len(p.plano_parcelas)
        for i, parcela in enumerate(p.plano_parcelas, start=1):
            if not isinstance(parcela, dict):
                continue
            date_str = parcela.get("date")
            if not date_str:
                continue
            try:
                parcela_date = date.fromisoformat(date_str)
            except (ValueError, TypeError):
                continue
            if start <= parcela_date <= end:
                add_entry(parcela_date, {
                    "tipo": "parcela",
                    "id_pedido": str(p.id),
                    "numero_os": p.numero_os,
                    "numero_parcela": i,
                    "total_parcelas": total,
                    "valor": float(parcela.get("value", 0)),
                })

    return result
