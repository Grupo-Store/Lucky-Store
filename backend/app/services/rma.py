import math
from datetime import datetime, timezone, date
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc
from app.models.rma import Rma, RmaStatus
from app.models.item_rma import ItemRma, ItemRmaStatus
from app.models.pedido import Pedido
from app.models.status_history import StatusHistory, EntityType
from app.models.audit_log import AuditLog, AuditAction
from app.schemas.rma import RmaCreate, ItemRmaStatusUpdate
from app.utils.errors import NotFoundException, BusinessLogicException


def _audit(db: Session, action: AuditAction, entity_id, changed_by: UUID,
           old_values: dict = None, new_values: dict = None):
    db.add(AuditLog(
        entity_type="rma",
        entity_id=entity_id,
        action=action,
        changed_by=changed_by,
        old_values=old_values,
        new_values=new_values,
    ))


def _generate_numero_rma(db: Session) -> str:
    year = datetime.now().year
    prefix = f"RMA-{year}-"
    count = db.query(Rma).filter(Rma.numero_rma.like(f"{prefix}%")).count()
    return f"{prefix}{str(count + 1).zfill(6)}"


class RmaService:

    @staticmethod
    def create(db: Session, data: RmaCreate, current_user_id: UUID) -> Rma:
        pedido = db.query(Pedido).filter(
            Pedido.id == data.id_pedido_origem,
            Pedido.deleted_at.is_(None),
        ).first()
        if not pedido:
            raise NotFoundException(f"Pedido {data.id_pedido_origem} não encontrado")

        numero_rma = data.numero_rma or _generate_numero_rma(db)
        if db.query(Rma).filter(Rma.numero_rma == numero_rma).first():
            raise BusinessLogicException(f"Número RMA '{numero_rma}' já existe")

        rma = Rma(
            id_pedido_origem=pedido.id,
            id_vendedor=pedido.id_vendedor,
            id_loja=pedido.id_loja,
            numero_rma=numero_rma,
            data_registro=date.today(),
            prazo_entrega=data.prazo_entrega,
            status=RmaStatus.REGISTERED,
            created_by=current_user_id,
        )
        db.add(rma)
        db.flush()

        for item in data.itens:
            db.add(ItemRma(
                id_rma=rma.id,
                id_produto_origem=item.id_produto_origem,
                descricao=item.descricao,
                quantidade=item.quantidade,
                status=ItemRmaStatus.NOT_RECEIVED,
            ))

        _audit(db, AuditAction.CREATE, rma.id, current_user_id,
               new_values={"status": rma.status, "numero_rma": rma.numero_rma})

        db.add(StatusHistory(
            entity_type=EntityType.RMA,
            entity_id=rma.id,
            old_status=None,
            new_status=rma.status,
            changed_by=current_user_id,
            reason="RMA criado",
        ))

        db.commit()
        db.refresh(rma)
        return rma

    @staticmethod
    def get_by_id(db: Session, rma_id: UUID) -> Rma:
        rma = db.query(Rma).filter(
            Rma.id == rma_id,
            Rma.deleted_at.is_(None),
        ).first()
        if not rma:
            raise NotFoundException(f"RMA {rma_id} não encontrado")
        return rma

    @staticmethod
    def list(
        db: Session,
        page: int = 1,
        limit: int = 20,
        status: Optional[RmaStatus] = None,
        id_loja: Optional[UUID] = None,
        id_vendedor: Optional[UUID] = None,
        id_pedido_origem: Optional[UUID] = None,
        sort_by: str = "data_registro",
        sort_dir: str = "desc",
    ):
        q = db.query(Rma).filter(Rma.deleted_at.is_(None))

        if status:
            q = q.filter(Rma.status == status)
        if id_loja:
            q = q.filter(Rma.id_loja == id_loja)
        if id_vendedor:
            q = q.filter(Rma.id_vendedor == id_vendedor)
        if id_pedido_origem:
            q = q.filter(Rma.id_pedido_origem == id_pedido_origem)

        sort_col = getattr(Rma, sort_by, Rma.data_registro)
        q = q.order_by(desc(sort_col) if sort_dir == "desc" else asc(sort_col))

        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()
        return items, total, math.ceil(total / limit) if total else 0

    @staticmethod
    def close(db: Session, rma_id: UUID, current_user_id: UUID) -> Rma:
        rma = RmaService.get_by_id(db, rma_id)

        if rma.status == RmaStatus.COMPLETED:
            raise BusinessLogicException("RMA já está concluído")
        if rma.status == RmaStatus.CANCELLED:
            raise BusinessLogicException("RMA cancelado não pode ser concluído")

        old_status = rma.status
        rma.status = RmaStatus.COMPLETED

        db.add(StatusHistory(
            entity_type=EntityType.RMA,
            entity_id=rma.id,
            old_status=old_status,
            new_status=RmaStatus.COMPLETED,
            changed_by=current_user_id,
            reason="RMA concluído",
        ))
        _audit(db, AuditAction.UPDATE, rma.id, current_user_id,
               old_values={"status": old_status}, new_values={"status": RmaStatus.COMPLETED})

        db.commit()
        db.refresh(rma)
        return rma

    @staticmethod
    def update_item_status(
        db: Session,
        rma_id: UUID,
        item_id: UUID,
        data: ItemRmaStatusUpdate,
        current_user_id: UUID,
    ) -> ItemRma:
        RmaService.get_by_id(db, rma_id)

        item = db.query(ItemRma).filter(
            ItemRma.id == item_id,
            ItemRma.id_rma == rma_id,
        ).first()
        if not item:
            raise NotFoundException(f"Item {item_id} não encontrado no RMA {rma_id}")

        old_status = item.status
        item.status = data.new_status
        if data.consertado_por is not None:
            item.consertado_por = data.consertado_por

        db.add(StatusHistory(
            entity_type=EntityType.ITEM_RMA,
            entity_id=item.id,
            old_status=old_status,
            new_status=data.new_status,
            changed_by=current_user_id,
            reason=None,
        ))
        _audit(db, AuditAction.UPDATE, item.id, current_user_id,
               old_values={"status": old_status}, new_values={"status": data.new_status})

        db.commit()
        db.refresh(item)
        return item
