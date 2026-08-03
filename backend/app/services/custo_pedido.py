from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.pedido import CustoPedido
from app.schemas.pedido import CustoPedidoIn, CustoPedidoOut, FinancialsOut, CustoComFinancialsOut
from app.services.pedido import PedidoService
from app.models.audit_log import AuditLog, AuditAction
from app.utils.errors import NotFoundException, BusinessLogicException


def _calculate_financials(custo: CustoPedido, valor_venda: Optional[Decimal]) -> FinancialsOut:
    """Função pura: calcula totais e margens a partir dos campos de custo."""
    def _d(v):
        return v if v is not None else Decimal(0)

    # custo_produto_inicial é EXCLUÍDO — é estimativa, não custo real
    custo_total = (
        _d(custo.custo_produto_final)
        + _d(custo.custo_servico)
        + _d(custo.brinde)
        + _d(custo.imposto_compra)
        + _d(custo.imposto_venda)
        + _d(custo.custo_credito)
        + _d(custo.custo_debito)
        + _d(custo.custo_boleto)
    )

    if valor_venda is None:
        return FinancialsOut(custo_total=custo_total, lucro_liquido=None, margem_bruta_pct=None)

    lucro_liquido = valor_venda - custo_total
    # Escala 0–1, igual à `margem` do dashboard (services/dashboard.py). Antes esta função
    # devolvia 0–100 e a do dashboard 0–1: misturar as duas fontes exibia "2500%".
    margem_bruta_pct = (
        (lucro_liquido / valor_venda).quantize(Decimal("0.0001")) if valor_venda != 0 else None
    )
    return FinancialsOut(
        custo_total=custo_total,
        lucro_liquido=lucro_liquido,
        margem_bruta_pct=margem_bruta_pct,
    )


class CustoPedidoService:

    @staticmethod
    def create_costs(
        db: Session, pedido_id: UUID, data: CustoPedidoIn, current_user_id: UUID
    ) -> CustoComFinancialsOut:
        pedido = PedidoService.get_by_id(db, pedido_id)

        existing = db.query(CustoPedido).filter(CustoPedido.id_pedido == pedido_id).first()
        if existing:
            raise BusinessLogicException("Pedido já possui custos. Use PUT para atualizar.")

        custo = CustoPedido(id_pedido=pedido_id, **data.model_dump())
        db.add(custo)
        db.flush()

        db.add(AuditLog(
            entity_type="custo_pedido",
            entity_id=custo.id,
            action=AuditAction.CREATE,
            changed_by=current_user_id,
            new_values=data.model_dump(mode="json"),
        ))

        db.commit()
        db.refresh(custo)

        financials = _calculate_financials(custo, pedido.valor_venda)
        custo_out = CustoPedidoOut.model_validate(custo)
        return CustoComFinancialsOut(**custo_out.model_dump(), financials=financials)

    @staticmethod
    def update_costs(
        db: Session, pedido_id: UUID, data: CustoPedidoIn, current_user_id: UUID
    ) -> CustoComFinancialsOut:
        pedido = PedidoService.get_by_id(db, pedido_id)

        custo = db.query(CustoPedido).filter(CustoPedido.id_pedido == pedido_id).first()
        if not custo:
            raise NotFoundException("Custo não encontrado. Use POST para criar.")

        # old_values precisa ser o estado ANTES da atualização, lido do banco.
        # Antes lia data.model_dump() (o próprio request), então o histórico registrava
        # os valores novos como se fossem os antigos.
        old_values = {
            field: (str(getattr(custo, field)) if getattr(custo, field, None) is not None else None)
            for field in data.model_dump().keys()
        }

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(custo, field, value)

        db.add(AuditLog(
            entity_type="custo_pedido",
            entity_id=custo.id,
            action=AuditAction.UPDATE,
            changed_by=current_user_id,
            old_values=old_values,
            new_values=data.model_dump(mode="json"),
        ))

        db.commit()
        db.refresh(custo)

        financials = _calculate_financials(custo, pedido.valor_venda)
        custo_out = CustoPedidoOut.model_validate(custo)
        return CustoComFinancialsOut(**custo_out.model_dump(), financials=financials)
