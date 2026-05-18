import math
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import asc, desc, text
from app.models.pedido import Pedido, PedidoFormaPagamento, CustoPedido
from app.models.cliente import Cliente
from app.models.rma import Rma
from app.models.status_history import StatusHistory, EntityType
from app.models.audit_log import AuditLog, AuditAction
from app.schemas.pedido import PedidoCreate, PedidoUpdate
from app.utils.errors import NotFoundException, BusinessLogicException


def _generate_numero_os(db: Session) -> str:
    num = db.execute(text("SELECT nextval('pedido_os_seq')")).scalar()
    return f"OS-{str(num).zfill(3)}"


def _audit(db: Session, action: AuditAction, entity_id, changed_by: UUID,
           old_values: dict = None, new_values: dict = None,
           ip_address: str = None, user_agent: str = None):
    db.add(AuditLog(
        entity_type="pedido",
        entity_id=entity_id,
        action=action,
        changed_by=changed_by,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
    ))


def _economia(pedido: Pedido) -> Optional[Decimal]:
    if pedido.valor_venda is None or pedido.custo is None:
        return None
    custo_total = (pedido.custo.custo_produto_final or Decimal(0)) + (pedido.custo.custo_servico or Decimal(0))
    return pedido.valor_venda - custo_total


def _get_or_create_cliente(db: Session, nome: str, cpf_cnpj: Optional[str]) -> UUID:
    if cpf_cnpj:
        cliente = db.query(Cliente).filter(
            Cliente.cnpj == cpf_cnpj,
            Cliente.deleted_at.is_(None),
        ).first()
        if cliente:
            return cliente.id
    cliente = Cliente(nome=nome, cnpj=cpf_cnpj or None)
    db.add(cliente)
    db.flush()
    return cliente.id


class PedidoService:

    @staticmethod
    def create(db: Session, data: PedidoCreate, current_user_id: UUID,
               ip_address: str = None, user_agent: str = None) -> Pedido:
        id_cliente = _get_or_create_cliente(db, data.nome_cliente, data.cpf_cnpj)
        pedido = Pedido(
            id_loja=data.id_loja,
            id_vendedor=data.id_vendedor,
            id_cliente=id_cliente,
            numero_os=data.numero_os or _generate_numero_os(db),
            numero_nf=data.numero_nf,
            numero_oc=data.numero_oc,
            data_pedido=data.data_pedido,
            data_entrega=data.data_entrega,
            status=data.status,
            is_rma=data.is_rma,
            is_cancelled=data.is_cancelled,
            is_direct_billing=data.is_direct_billing,
            valor_venda=data.valor_venda,
            parcelas=data.parcelas,
            observacao=data.observacao,
            fornecedor_principal=data.fornecedor_principal,
            nota_fiscal_fornecedor=data.nota_fiscal_fornecedor,
            created_by=current_user_id,
        )
        db.add(pedido)
        db.flush()  # get id before commit

        for fp in data.formas_pagamento:
            db.add(PedidoFormaPagamento(id_pedido=pedido.id, forma=fp.forma))

        if data.custo:
            db.add(CustoPedido(id_pedido=pedido.id, **data.custo.model_dump()))

        _audit(db, AuditAction.CREATE, pedido.id, current_user_id,
               new_values={"status": pedido.status, "numero_os": pedido.numero_os},
               ip_address=ip_address, user_agent=user_agent)

        db.add(StatusHistory(
            entity_type=EntityType.PEDIDO,
            entity_id=pedido.id,
            old_status=None,
            new_status=pedido.status,
            changed_by=current_user_id,
            reason="Pedido criado",
        ))

        db.commit()
        db.refresh(pedido)
        pedido.economia = _economia(pedido)
        return pedido

    @staticmethod
    def list(
        db: Session,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        id_loja: Optional[UUID] = None,
        id_vendedor: Optional[UUID] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
        sort_by: str = "data_pedido",
        sort_dir: str = "desc",
        numero_os: Optional[str] = None,
    ):
        base_filters = [Pedido.deleted_at.is_(None)]
        if status:
            base_filters.append(Pedido.status == status)
        if id_loja:
            base_filters.append(Pedido.id_loja == id_loja)
        if id_vendedor:
            base_filters.append(Pedido.id_vendedor == id_vendedor)
        if data_inicio:
            base_filters.append(Pedido.data_pedido >= data_inicio)
        if data_fim:
            base_filters.append(Pedido.data_pedido <= data_fim)
        if numero_os:
            base_filters.append(Pedido.numero_os.ilike(f"%{numero_os}%"))

        total = db.query(Pedido).filter(*base_filters).count()

        sort_col = getattr(Pedido, sort_by, Pedido.data_pedido)
        items = (
            db.query(Pedido)
            .options(
                joinedload(Pedido.loja),
                joinedload(Pedido.vendedor),
                joinedload(Pedido.cliente),
                joinedload(Pedido.produtos),
                joinedload(Pedido.formas_pagamento),
                joinedload(Pedido.fretes),
                joinedload(Pedido.custo),
            )
            .filter(*base_filters)
            .order_by(desc(sort_col) if sort_dir == "desc" else asc(sort_col))
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        for p in items:
            p.economia = _economia(p)

        return items, total, math.ceil(total / limit) if total else 0

    @staticmethod
    def get_by_id(db: Session, pedido_id: UUID) -> Pedido:
        pedido = db.query(Pedido).filter(
            Pedido.id == pedido_id,
            Pedido.deleted_at.is_(None),
        ).first()
        if not pedido:
            raise NotFoundException(f"Pedido {pedido_id} não encontrado")
        pedido.economia = _economia(pedido)
        return pedido

    @staticmethod
    def get_status_history(db: Session, pedido_id: UUID):
        return (
            db.query(StatusHistory)
            .filter(
                StatusHistory.entity_type == EntityType.PEDIDO,
                StatusHistory.entity_id == pedido_id,
            )
            .order_by(StatusHistory.changed_at.asc())
            .all()
        )

    @staticmethod
    def update(db: Session, pedido_id: UUID, data: PedidoUpdate, current_user_id: UUID,
               ip_address: str = None, user_agent: str = None) -> Pedido:
        pedido = PedidoService.get_by_id(db, pedido_id)

        old_values = {
            "numero_os": pedido.numero_os,
            "status": pedido.status,
            "valor_venda": str(pedido.valor_venda) if pedido.valor_venda else None,
        }

        dump = data.model_dump(exclude_none=True)
        custo_data = dump.pop('custo', None)

        for field, value in dump.items():
            setattr(pedido, field, value)

        if custo_data:
            if pedido.custo:
                for k, v in custo_data.items():
                    setattr(pedido.custo, k, v)
            else:
                db.add(CustoPedido(id_pedido=pedido.id, **custo_data))

        new_values = {
            "numero_os": pedido.numero_os,
            "status": pedido.status,
            "valor_venda": str(pedido.valor_venda) if pedido.valor_venda else None,
        }

        _audit(db, AuditAction.UPDATE, pedido.id, current_user_id,
               old_values=old_values, new_values=new_values,
               ip_address=ip_address, user_agent=user_agent)

        db.commit()
        db.refresh(pedido)
        pedido.economia = _economia(pedido)
        return pedido

    @staticmethod
    def change_status(db: Session, pedido_id: UUID, new_status: str,
                      current_user_id: UUID, reason: Optional[str] = None,
                      ip_address: str = None, user_agent: str = None) -> Pedido:
        pedido = PedidoService.get_by_id(db, pedido_id)
        old_status = pedido.status
        pedido.status = new_status
        if new_status == "Cancelled":
            pedido.is_cancelled = True

        db.add(StatusHistory(
            entity_type=EntityType.PEDIDO,
            entity_id=pedido.id,
            old_status=old_status,
            new_status=new_status,
            changed_by=current_user_id,
            reason=reason,
        ))

        _audit(db, AuditAction.UPDATE, pedido.id, current_user_id,
               old_values={"status": old_status}, new_values={"status": new_status},
               ip_address=ip_address, user_agent=user_agent)

        db.commit()
        db.refresh(pedido)
        pedido.economia = _economia(pedido)
        return pedido

    @staticmethod
    def soft_delete(db: Session, pedido_id: UUID, current_user_id: UUID,
                    ip_address: str = None, user_agent: str = None) -> None:
        pedido = PedidoService.get_by_id(db, pedido_id)

        has_rma = db.query(Rma).filter(Rma.id_pedido_origem == pedido_id).first()
        if has_rma:
            raise BusinessLogicException("Pedido não pode ser excluído pois possui RMA(s) vinculado(s)")

        pedido.deleted_at = datetime.now(timezone.utc)

        _audit(db, AuditAction.DELETE, pedido.id, current_user_id,
               old_values={"status": pedido.status, "numero_os": pedido.numero_os},
               ip_address=ip_address, user_agent=user_agent)

        db.commit()
