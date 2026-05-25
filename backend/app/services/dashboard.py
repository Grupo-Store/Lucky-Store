from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.pedido import Pedido, CustoPedido
from app.models.loja import Loja
from app.models.vendedor import Vendedor
from app.models.dashboard_goal import DashboardGoal
from app.schemas.dashboard import (
    DashboardKpisResponse,
    BreakdownByCompanyResponse,
    BreakdownBySellerResponse,
    BreakdownItem,
    BreakdownBySellerItem,
    GoalCreate,
    GoalResponse,
    GoalsListResponse,
    ProjectionsResponse,
)
from app.utils.errors import NotFoundException


# ─── Feriados Nacionais Brasileiros ───────────────────────────────────────────

_FERIADOS: set[date] = {
    # 2025
    date(2025, 1, 1), date(2025, 3, 3), date(2025, 3, 4),
    date(2025, 4, 18), date(2025, 4, 21), date(2025, 5, 1),
    date(2025, 6, 19), date(2025, 9, 7), date(2025, 10, 12),
    date(2025, 11, 2), date(2025, 11, 15), date(2025, 11, 20),
    date(2025, 12, 25),
    # 2026
    date(2026, 1, 1), date(2026, 2, 16), date(2026, 2, 17),
    date(2026, 4, 3), date(2026, 4, 21), date(2026, 5, 1),
    date(2026, 5, 14), date(2026, 9, 7), date(2026, 10, 12),
    date(2026, 11, 2), date(2026, 11, 15), date(2026, 11, 20),
    date(2026, 12, 25),
    # 2027
    date(2027, 1, 1), date(2027, 2, 8), date(2027, 2, 9),
    date(2027, 3, 26), date(2027, 4, 21), date(2027, 5, 1),
    date(2027, 6, 3), date(2027, 9, 7), date(2027, 10, 12),
    date(2027, 11, 2), date(2027, 11, 15), date(2027, 11, 20),
    date(2027, 12, 25),
}


def _is_working_day(d: date) -> bool:
    return d.weekday() < 5 and d not in _FERIADOS


def _count_working_days(start: date, end: date) -> int:
    if start > end:
        return 0
    total = 0
    current = start
    while current <= end:
        if _is_working_day(current):
            total += 1
        current += timedelta(days=1)
    return total


# ─── Período helpers ──────────────────────────────────────────────────────────

def _resolve_period(
    mes: Optional[int],
    ano: Optional[int],
    data_inicio: Optional[date],
    data_fim: Optional[date],
) -> tuple[date, date]:
    if data_inicio and data_fim:
        return data_inicio, data_fim
    today = date.today()
    m = mes or today.month
    y = ano or today.year
    inicio = date(y, m, 1)
    if m == 12:
        fim = date(y, 12, 31)
    else:
        fim = date(y, m + 1, 1) - timedelta(days=1)
    return inicio, fim


# ─── Agregação principal ──────────────────────────────────────────────────────

def _aggregate(
    db: Session,
    inicio: date,
    fim: date,
    id_loja: Optional[UUID],
    include_cancelled: bool = False,
):
    """Retorna Row com somas de receita, custo e impostos."""
    q = (
        db.query(
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(False), Pedido.valor_venda), else_=0)
            ), 0).label("receita"),
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(False), CustoPedido.custo_produto_final), else_=0)
            ), 0).label("custo_produto"),
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(False), CustoPedido.custo_servico), else_=0)
            ), 0).label("custo_servico"),
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(False), CustoPedido.imposto_compra), else_=0)
            ), 0).label("imposto_compra"),
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(False), CustoPedido.imposto_venda), else_=0)
            ), 0).label("imposto_venda"),
            func.count(case((Pedido.is_cancelled.is_(False), 1))).label("num_pedidos"),
            func.count(case((Pedido.is_cancelled.is_(True), 1))).label("num_cancelamentos"),
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(True), Pedido.valor_venda), else_=0)
            ), 0).label("valor_cancelamentos"),
        )
        .outerjoin(CustoPedido, CustoPedido.id_pedido == Pedido.id)
        .filter(
            Pedido.deleted_at.is_(None),
            Pedido.is_rma.is_(False),
            Pedido.data_pedido >= inicio,
            Pedido.data_pedido <= fim,
        )
    )
    if id_loja:
        q = q.filter(Pedido.id_loja == id_loja)
    return q.first()


# ─── KPIs ─────────────────────────────────────────────────────────────────────

def get_kpis(
    db: Session,
    mes: Optional[int] = None,
    ano: Optional[int] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    id_loja: Optional[UUID] = None,
) -> DashboardKpisResponse:
    inicio, fim = _resolve_period(mes, ano, data_inicio, data_fim)
    row = _aggregate(db, inicio, fim, id_loja)

    receita = Decimal(str(row.receita or 0))
    custo_produto = Decimal(str(row.custo_produto or 0))
    custo_servico = Decimal(str(row.custo_servico or 0))
    imposto_compra = Decimal(str(row.imposto_compra or 0))
    imposto_venda = Decimal(str(row.imposto_venda or 0))
    custo = custo_produto + custo_servico
    lucro = receita - custo
    margem = (lucro / receita).quantize(Decimal("0.0001")) if receita > 0 else Decimal("0")
    outros_custos = max(custo - imposto_compra - imposto_venda, Decimal("0"))
    num_pedidos = row.num_pedidos or 0

    # Receita de hoje
    today = date.today()
    today_q = (
        db.query(func.coalesce(func.sum(Pedido.valor_venda), 0))
        .filter(
            Pedido.deleted_at.is_(None),
            Pedido.is_rma.is_(False),
            Pedido.is_cancelled.is_(False),
            Pedido.data_pedido == today,
        )
    )
    if id_loja:
        today_q = today_q.filter(Pedido.id_loja == id_loja)
    receita_hoje = Decimal(str(today_q.scalar() or 0))

    return DashboardKpisResponse(
        periodo_inicio=inicio,
        periodo_fim=fim,
        receita=receita,
        custo=custo,
        lucro=lucro,
        margem=margem,
        num_pedidos=num_pedidos,
        num_cancelamentos=row.num_cancelamentos or 0,
        valor_cancelamentos=Decimal(str(row.valor_cancelamentos or 0)),
        receita_hoje=receita_hoje,
        ticket_venda=(receita / num_pedidos).quantize(Decimal("0.01")) if num_pedidos else Decimal("0"),
        ticket_lucro=(lucro / num_pedidos).quantize(Decimal("0.01")) if num_pedidos else Decimal("0"),
        ticket_custo=(custo / num_pedidos).quantize(Decimal("0.01")) if num_pedidos else Decimal("0"),
        imposto_compra=imposto_compra,
        imposto_venda=imposto_venda,
        outros_custos=outros_custos,
    )


# ─── Breakdowns ───────────────────────────────────────────────────────────────

def get_breakdown_by_company(
    db: Session,
    mes: Optional[int] = None,
    ano: Optional[int] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    id_loja: Optional[UUID] = None,
) -> BreakdownByCompanyResponse:
    inicio, fim = _resolve_period(mes, ano, data_inicio, data_fim)

    q = (
        db.query(
            Loja.nome.label("nome"),
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(False), Pedido.valor_venda), else_=0)
            ), 0).label("receita"),
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(False),
                      CustoPedido.custo_produto_final + CustoPedido.custo_servico), else_=0)
            ), 0).label("custo"),
            func.count(case((Pedido.is_cancelled.is_(False), 1))).label("num_pedidos"),
            func.count(case((Pedido.is_cancelled.is_(True), 1))).label("num_cancelamentos"),
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(True), Pedido.valor_venda), else_=0)
            ), 0).label("valor_cancelamentos"),
        )
        .join(Loja, Loja.id == Pedido.id_loja)
        .outerjoin(CustoPedido, CustoPedido.id_pedido == Pedido.id)
        .filter(
            Pedido.deleted_at.is_(None),
            Pedido.is_rma.is_(False),
            Pedido.data_pedido >= inicio,
            Pedido.data_pedido <= fim,
        )
        .group_by(Loja.id, Loja.nome)
        .order_by(func.sum(
            case((Pedido.is_cancelled.is_(False), Pedido.valor_venda), else_=0)
        ).desc())
    )
    if id_loja:
        q = q.filter(Pedido.id_loja == id_loja)

    items = []
    for row in q.all():
        receita = Decimal(str(row.receita or 0))
        custo = Decimal(str(row.custo or 0))
        lucro = receita - custo
        margem = (lucro / receita).quantize(Decimal("0.0001")) if receita > 0 else Decimal("0")
        num_pedidos = row.num_pedidos or 0
        items.append(BreakdownItem(
            nome=row.nome,
            receita=receita,
            custo=custo,
            lucro=lucro,
            margem=margem,
            num_pedidos=num_pedidos,
            num_cancelamentos=row.num_cancelamentos or 0,
            valor_cancelamentos=Decimal(str(row.valor_cancelamentos or 0)),
            ticket_venda=(receita / num_pedidos).quantize(Decimal("0.01")) if num_pedidos else Decimal("0"),
            ticket_custo=(custo / num_pedidos).quantize(Decimal("0.01")) if num_pedidos else Decimal("0"),
            ticket_lucro=(lucro / num_pedidos).quantize(Decimal("0.01")) if num_pedidos else Decimal("0"),
        ))
    return BreakdownByCompanyResponse(items=items)


def get_breakdown_by_seller(
    db: Session,
    mes: Optional[int] = None,
    ano: Optional[int] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    id_loja: Optional[UUID] = None,
) -> BreakdownBySellerResponse:
    inicio, fim = _resolve_period(mes, ano, data_inicio, data_fim)

    q = (
        db.query(
            Vendedor.id.label("id_vendedor"),
            Vendedor.nome.label("nome"),
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(False), Pedido.valor_venda), else_=0)
            ), 0).label("receita"),
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(False),
                      CustoPedido.custo_produto_final + CustoPedido.custo_servico), else_=0)
            ), 0).label("custo"),
            func.count(case((Pedido.is_cancelled.is_(False), 1))).label("num_pedidos"),
            func.count(case((Pedido.is_cancelled.is_(True), 1))).label("num_cancelamentos"),
            func.coalesce(func.sum(
                case((Pedido.is_cancelled.is_(True), Pedido.valor_venda), else_=0)
            ), 0).label("valor_cancelamentos"),
        )
        .join(Vendedor, Vendedor.id == Pedido.id_vendedor)
        .outerjoin(CustoPedido, CustoPedido.id_pedido == Pedido.id)
        .filter(
            Pedido.deleted_at.is_(None),
            Pedido.is_rma.is_(False),
            Pedido.data_pedido >= inicio,
            Pedido.data_pedido <= fim,
        )
        .group_by(Vendedor.id, Vendedor.nome)
        .order_by(func.sum(
            case((Pedido.is_cancelled.is_(False), Pedido.valor_venda), else_=0)
        ).desc())
    )
    if id_loja:
        q = q.filter(Pedido.id_loja == id_loja)

    items = []
    for row in q.all():
        receita = Decimal(str(row.receita or 0))
        custo = Decimal(str(row.custo or 0))
        lucro = receita - custo
        margem = (lucro / receita).quantize(Decimal("0.0001")) if receita > 0 else Decimal("0")
        num_pedidos = row.num_pedidos or 0
        items.append(BreakdownBySellerItem(
            id_vendedor=row.id_vendedor,
            nome=row.nome,
            receita=receita,
            custo=custo,
            lucro=lucro,
            margem=margem,
            num_pedidos=num_pedidos,
            num_cancelamentos=row.num_cancelamentos or 0,
            valor_cancelamentos=Decimal(str(row.valor_cancelamentos or 0)),
            ticket_venda=(receita / num_pedidos).quantize(Decimal("0.01")) if num_pedidos else Decimal("0"),
            ticket_custo=(custo / num_pedidos).quantize(Decimal("0.01")) if num_pedidos else Decimal("0"),
            ticket_lucro=(lucro / num_pedidos).quantize(Decimal("0.01")) if num_pedidos else Decimal("0"),
        ))
    return BreakdownBySellerResponse(items=items)


# ─── Goals ────────────────────────────────────────────────────────────────────

def _goal_to_response(goal: DashboardGoal, nome_loja: Optional[str] = None) -> GoalResponse:
    return GoalResponse(
        id=goal.id,
        ano=goal.ano,
        mes=goal.mes,
        id_loja=goal.id_loja,
        nome_loja=nome_loja,
        target=goal.target,
        floor=goal.floor,
    )


def list_goals(
    db: Session,
    ano: Optional[int] = None,
    mes: Optional[int] = None,
    id_loja: Optional[UUID] = None,
) -> GoalsListResponse:
    q = db.query(DashboardGoal, Loja.nome).join(Loja, Loja.id == DashboardGoal.id_loja)
    if ano:
        q = q.filter(DashboardGoal.ano == ano)
    if mes:
        q = q.filter(DashboardGoal.mes == mes)
    if id_loja:
        q = q.filter(DashboardGoal.id_loja == id_loja)
    q = q.order_by(DashboardGoal.ano.desc(), DashboardGoal.mes.desc())

    return GoalsListResponse(items=[_goal_to_response(g, nome) for g, nome in q.all()])


def upsert_goal(db: Session, data: GoalCreate) -> GoalResponse:
    existing = db.query(DashboardGoal).filter(
        DashboardGoal.ano == data.ano,
        DashboardGoal.mes == data.mes,
        DashboardGoal.id_loja == data.id_loja,
    ).first()

    if existing:
        existing.target = data.target
        existing.floor = data.floor
        db.commit()
        db.refresh(existing)
        goal = existing
    else:
        goal = DashboardGoal(
            ano=data.ano,
            mes=data.mes,
            id_loja=data.id_loja,
            target=data.target,
            floor=data.floor,
        )
        db.add(goal)
        db.commit()
        db.refresh(goal)

    loja = db.query(Loja).filter(Loja.id == goal.id_loja).first()
    return _goal_to_response(goal, loja.nome if loja else None)


def delete_goal(db: Session, goal_id: UUID) -> None:
    goal = db.query(DashboardGoal).filter(DashboardGoal.id == goal_id).first()
    if not goal:
        raise NotFoundException(f"Meta {goal_id} não encontrada")
    db.delete(goal)
    db.commit()


# ─── Projections ──────────────────────────────────────────────────────────────

def get_projections(
    db: Session,
    mes: Optional[int] = None,
    ano: Optional[int] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    id_loja: Optional[UUID] = None,
) -> ProjectionsResponse:
    inicio, fim = _resolve_period(mes, ano, data_inicio, data_fim)
    today = date.today()

    # Dias úteis decorridos: de inicio até hoje (ou fim do período, o que vier primeiro)
    ate_hoje = min(today, fim)
    dias_decorridos = _count_working_days(inicio, ate_hoje) if ate_hoje >= inicio else 0

    # Dias úteis restantes: de amanhã até o fim do período
    amanha = today + timedelta(days=1)
    dias_restantes = _count_working_days(amanha, fim) if amanha <= fim else 0

    # KPIs do período
    kpis = get_kpis(db, mes, ano, data_inicio, data_fim, id_loja)
    receita = kpis.receita

    media_diaria = (receita / dias_decorridos).quantize(Decimal("0.01")) if dias_decorridos > 0 else Decimal("0")
    projecao_mes = (media_diaria * (dias_decorridos + dias_restantes)).quantize(Decimal("0.01"))

    # Meta do período
    goal = None
    if not (data_inicio or data_fim):
        m = mes or today.month
        y = ano or today.year
        goal_loja = id_loja
        q = db.query(DashboardGoal).filter(DashboardGoal.ano == y, DashboardGoal.mes == m)
        if goal_loja:
            q = q.filter(DashboardGoal.id_loja == goal_loja)
        goal = q.first()

    meta_target = Decimal(str(goal.target)) if goal else None
    meta_floor = Decimal(str(goal.floor)) if goal and goal.floor else None

    gap_target = max(meta_target - receita, Decimal("0")) if meta_target else None
    gap_floor = max(meta_floor - receita, Decimal("0")) if meta_floor else None
    pct_meta = (receita / meta_target).quantize(Decimal("0.0001")) if meta_target and meta_target > 0 else None

    meta_diaria_dinamica = None
    if gap_floor is not None and dias_restantes > 0:
        meta_diaria_dinamica = (gap_floor / dias_restantes).quantize(Decimal("0.01"))

    return ProjectionsResponse(
        periodo_inicio=inicio,
        periodo_fim=fim,
        dias_uteis_decorridos=dias_decorridos,
        dias_uteis_restantes=dias_restantes,
        media_diaria=media_diaria,
        projecao_mes=projecao_mes,
        meta_target=meta_target,
        meta_floor=meta_floor,
        gap_target=gap_target,
        gap_floor=gap_floor,
        meta_diaria_dinamica=meta_diaria_dinamica,
        pct_meta=pct_meta,
    )
