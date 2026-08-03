import math
from datetime import datetime, timezone, date
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import asc, desc
from sqlalchemy.exc import IntegrityError
from app.models.rma import Rma, RmaStatus
from app.models.item_rma import ItemRma, ItemRmaStatus
from app.models.pedido import Pedido
from app.models.status_history import StatusHistory, EntityType
from app.models.audit_log import AuditLog, AuditAction
from app.schemas.rma import RmaCreate, RmaUpdate, ItemRmaStatusUpdate
from app.utils.errors import NotFoundException, BusinessLogicException


def _audit(db: Session, action: AuditAction, entity_id, changed_by: UUID,
           old_values: dict = None, new_values: dict = None,
           entity_type: str = "rma"):
    db.add(AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        changed_by=changed_by,
        old_values=old_values,
        new_values=new_values,
    ))


_ITEM_STATUS_LEVEL = {
    ItemRmaStatus.NOT_RECEIVED: 0,
    ItemRmaStatus.RECEIVED: 1,
    ItemRmaStatus.SENT_FOR_REPAIR: 2,
    ItemRmaStatus.IN_REPAIR: 3,
    ItemRmaStatus.REPAIRED_NOT_RECEIVED: 4,
    ItemRmaStatus.REPAIRED_RECEIVED: 5,
    ItemRmaStatus.TO_PACK: 6,
    ItemRmaStatus.READY_FOR_DELIVERY: 7,
    ItemRmaStatus.OUT_FOR_DELIVERY: 8,
    ItemRmaStatus.DELIVERED: 9,
    ItemRmaStatus.ESTORNO: 10,
}

_RMA_STATUS_LEVEL = {
    RmaStatus.REGISTERED: 0,
    RmaStatus.IN_ANALYSIS: 1,
    RmaStatus.APPROVED: 2,
    RmaStatus.IN_REPAIR: 3,
    RmaStatus.REPAIRED: 4,
    RmaStatus.READY: 5,
    RmaStatus.SHIPPED: 6,
    RmaStatus.DELIVERED: 7,
    RmaStatus.COMPLETED: 8,
    RmaStatus.CANCELLED: 9,
    RmaStatus.REEMBOLSO: 10,
}

_VALID_TRANSITIONS: dict[RmaStatus, set] = {
    RmaStatus.REGISTERED:  {RmaStatus.IN_ANALYSIS, RmaStatus.CANCELLED},
    RmaStatus.IN_ANALYSIS: {RmaStatus.APPROVED, RmaStatus.CANCELLED, RmaStatus.REEMBOLSO},
    RmaStatus.APPROVED:    {RmaStatus.IN_REPAIR, RmaStatus.CANCELLED, RmaStatus.REEMBOLSO},
    RmaStatus.IN_REPAIR:   {RmaStatus.REPAIRED, RmaStatus.CANCELLED, RmaStatus.REEMBOLSO},
    RmaStatus.REPAIRED:    {RmaStatus.READY, RmaStatus.CANCELLED, RmaStatus.REEMBOLSO},
    RmaStatus.READY:       {RmaStatus.SHIPPED, RmaStatus.CANCELLED, RmaStatus.REEMBOLSO},
    RmaStatus.SHIPPED:     {RmaStatus.DELIVERED, RmaStatus.CANCELLED, RmaStatus.REEMBOLSO},
    RmaStatus.DELIVERED:   {RmaStatus.COMPLETED, RmaStatus.CANCELLED, RmaStatus.REEMBOLSO},
    RmaStatus.COMPLETED:   set(),
    RmaStatus.CANCELLED:   set(),
    RmaStatus.REEMBOLSO:   set(),
}


def _derive_rma_status_from_items(items: list) -> RmaStatus | None:
    """Returns the RMA status implied by the current item statuses, or None."""
    if not items:
        return None
    levels = [_ITEM_STATUS_LEVEL[i.status] for i in items]
    min_level = min(levels)
    max_level = max(levels)

    # ESTORNO é o nível mais alto de item (10) e não é "entregue" — é devolução de dinheiro.
    # Precisa ser testado ANTES de DELIVERED, senão min_level >= 9 captura o caso e o RMA
    # inteiro vira DELIVERED mesmo com todos os itens estornados.
    if min_level >= _ITEM_STATUS_LEVEL[ItemRmaStatus.ESTORNO]:
        return RmaStatus.REEMBOLSO
    if min_level >= _ITEM_STATUS_LEVEL[ItemRmaStatus.DELIVERED]:
        return RmaStatus.DELIVERED
    if min_level >= _ITEM_STATUS_LEVEL[ItemRmaStatus.OUT_FOR_DELIVERY]:
        return RmaStatus.SHIPPED
    if min_level >= _ITEM_STATUS_LEVEL[ItemRmaStatus.READY_FOR_DELIVERY]:
        return RmaStatus.READY
    if min_level >= _ITEM_STATUS_LEVEL[ItemRmaStatus.REPAIRED_RECEIVED]:
        return RmaStatus.REPAIRED
    if max_level >= _ITEM_STATUS_LEVEL[ItemRmaStatus.IN_REPAIR]:
        return RmaStatus.IN_REPAIR
    return None


def _generate_numero_rma(db: Session, numero_os: str, id_pedido: UUID) -> str:
    import re
    os_num = re.sub(r'^OS[-\s]?', '', numero_os, flags=re.IGNORECASE).strip('-').strip()
    count = db.query(Rma).filter(Rma.id_pedido_origem == id_pedido).count()
    return f"RMA-{os_num}-{count + 1}"


class RmaService:

    @staticmethod
    def create(db: Session, data: RmaCreate, current_user_id: UUID) -> Rma:
        pedido = db.query(Pedido).filter(
            Pedido.id == data.id_pedido_origem,
            Pedido.deleted_at.is_(None),
        ).first()
        if not pedido:
            raise NotFoundException(f"Pedido {data.id_pedido_origem} não encontrado")

        numero_rma = data.numero_rma or _generate_numero_rma(db, pedido.numero_os, pedido.id)
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
                fornecedor=item.fornecedor,
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

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise BusinessLogicException(f"Número RMA '{numero_rma}' já existe (criação simultânea detectada)")
        db.refresh(rma)
        return rma

    @staticmethod
    def get_by_id(db: Session, rma_id: UUID) -> Rma:
        rma = db.query(Rma).options(joinedload(Rma.pedido)).filter(
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
        data_inicio: Optional[date] = None,
        data_fim: Optional[date] = None,
        sort_by: str = "data_registro",
        sort_dir: str = "desc",
        numero_rma: Optional[str] = None,
    ):
        q = db.query(Rma).options(joinedload(Rma.pedido), joinedload(Rma.itens)).filter(Rma.deleted_at.is_(None))

        if status:
            q = q.filter(Rma.status == status)
        if id_loja:
            q = q.filter(Rma.id_loja == id_loja)
        if id_vendedor:
            q = q.filter(Rma.id_vendedor == id_vendedor)
        if id_pedido_origem:
            q = q.filter(Rma.id_pedido_origem == id_pedido_origem)
        if data_inicio:
            q = q.filter(Rma.data_registro >= data_inicio)
        if data_fim:
            q = q.filter(Rma.data_registro <= data_fim)
        if numero_rma:
            q = q.filter(Rma.numero_rma.ilike(f"%{numero_rma}%"))

        _SORT_WHITELIST = {"data_registro", "numero_rma", "status", "prazo_entrega", "created_at", "updated_at"}
        sort_col = getattr(Rma, sort_by if sort_by in _SORT_WHITELIST else "data_registro")
        q = q.order_by(desc(sort_col) if sort_dir == "desc" else asc(sort_col))

        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()
        return items, total, math.ceil(total / limit) if total else 0

    @staticmethod
    def get_status_history(db: Session, rma_id: UUID):
        return (
            db.query(StatusHistory)
            .filter(
                StatusHistory.entity_type == EntityType.RMA,
                StatusHistory.entity_id == rma_id,
            )
            .order_by(StatusHistory.changed_at.asc())
            .all()
        )

    @staticmethod
    def update(db: Session, rma_id: UUID, data: RmaUpdate, current_user_id: UUID) -> Rma:
        rma = RmaService.get_by_id(db, rma_id)

        old_status = rma.status
        if data.prazo_entrega is not None:
            rma.prazo_entrega = data.prazo_entrega
        if data.status is not None and data.status != rma.status:
            allowed = _VALID_TRANSITIONS.get(rma.status, set())
            if data.status not in allowed:
                raise BusinessLogicException(
                    f"Transição inválida: {rma.status.value} → {data.status.value}"
                )
            rma.status = data.status
            db.add(StatusHistory(
                entity_type=EntityType.RMA,
                entity_id=rma.id,
                old_status=old_status,
                new_status=data.status,
                changed_by=current_user_id,
                reason=None,
            ))
            _audit(db, AuditAction.UPDATE, rma.id, current_user_id,
                   old_values={"status": str(old_status)}, new_values={"status": str(data.status)})

        db.commit()
        db.refresh(rma)
        return rma

    @staticmethod
    def close(db: Session, rma_id: UUID, current_user_id: UUID) -> Rma:
        rma = RmaService.get_by_id(db, rma_id)

        if rma.status == RmaStatus.COMPLETED:
            raise BusinessLogicException("RMA já está concluído")
        if rma.status == RmaStatus.CANCELLED:
            raise BusinessLogicException("RMA cancelado não pode ser concluído")

        # close() precisa respeitar a mesma máquina de estados de update() — antes ela
        # gravava COMPLETED a partir de qualquer status, furando _VALID_TRANSITIONS.
        if RmaStatus.COMPLETED not in _VALID_TRANSITIONS.get(rma.status, set()):
            raise BusinessLogicException(
                f"Transição inválida: {rma.status} → {RmaStatus.COMPLETED}"
            )

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
               old_values={"status": str(old_status)}, new_values={"status": str(RmaStatus.COMPLETED)})

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
        fields_set = data.model_fields_set
        if "consertado_por" in fields_set:
            item.consertado_por = data.consertado_por
        if "fornecedor" in fields_set:
            item.fornecedor = data.fornecedor
        if "valor_estornado" in fields_set:
            item.valor_estornado = data.valor_estornado
        if "data_estorno" in fields_set:
            item.data_estorno = data.data_estorno
        if "motivo_estorno" in fields_set:
            item.motivo_estorno = data.motivo_estorno

        db.add(StatusHistory(
            entity_type=EntityType.ITEM_RMA,
            entity_id=item.id,
            old_status=old_status,
            new_status=data.new_status,
            changed_by=current_user_id,
            reason=None,
        ))
        _audit(db, AuditAction.UPDATE, item.id, current_user_id,
               old_values={"status": old_status}, new_values={"status": data.new_status},
               entity_type="item_rma")

        # Auto-avança o status do RMA com base no estado conjunto dos itens
        rma = db.query(Rma).filter(Rma.id == rma_id).first()
        all_items = db.query(ItemRma).filter(ItemRma.id_rma == rma_id).all()
        derived = _derive_rma_status_from_items(all_items)
        # REEMBOLSO é terminal tanto quanto COMPLETED/CANCELLED. Antes ficava de fora da
        # lista e só não quebrava porque o nível de REEMBOLSO (10) é maior que o de
        # qualquer status derivável — proteção acidental. Agora é explícita.
        non_terminal = rma.status not in (
            RmaStatus.COMPLETED, RmaStatus.CANCELLED, RmaStatus.REEMBOLSO,
        )
        if derived and non_terminal:
            derived_level = _RMA_STATUS_LEVEL.get(derived, 0)
            current_level = _RMA_STATUS_LEVEL.get(rma.status, 0)
            if derived_level > current_level:
                old_rma_status = rma.status
                rma.status = derived
                db.add(StatusHistory(
                    entity_type=EntityType.RMA,
                    entity_id=rma_id,
                    old_status=old_rma_status,
                    new_status=derived,
                    changed_by=current_user_id,
                    reason="Auto-avanço baseado nos itens",
                ))
                _audit(db, AuditAction.UPDATE, rma_id, current_user_id,
                       old_values={"status": str(old_rma_status)},
                       new_values={"status": str(derived)})

        db.commit()
        db.refresh(item)
        return item
