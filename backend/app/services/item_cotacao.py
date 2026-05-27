from uuid import UUID
from sqlalchemy.orm import Session

from app.models.cotacao import Cotacao
from app.models.item_cotacao import ItemCotacao
from app.models.audit_log import AuditLog, AuditAction
from app.schemas.cotacao import ItemCotacaoCreate
from app.utils.errors import NotFoundException
from app.services.cotacao import _calc_item_totals


def _audit(db: Session, action: AuditAction, entity_id, changed_by: UUID,
           old_values: dict = None, new_values: dict = None):
    db.add(AuditLog(
        entity_type="item_cotacao",
        entity_id=entity_id,
        action=action,
        changed_by=changed_by,
        old_values=old_values,
        new_values=new_values,
    ))


class ItemCotacaoService:

    @staticmethod
    def add_item(
        db: Session,
        cotacao_id: UUID,
        data: ItemCotacaoCreate,
        current_user_id: UUID,
    ) -> ItemCotacao:
        cotacao = db.query(Cotacao).filter(
            Cotacao.id == cotacao_id,
            Cotacao.deleted_at.is_(None),
        ).first()
        if not cotacao:
            raise NotFoundException(f"Cotação {cotacao_id} não encontrada")

        item = ItemCotacao(
            id_cotacao=cotacao_id,
            descricao=data.descricao,
            quantidade=data.quantidade,
            valor_unitario=data.valor_unitario,
            valor_fechamento=data.valor_fechamento,
            fornecedor=data.fornecedor,
        )
        db.add(item)
        db.flush()

        _audit(db, AuditAction.CREATE, item.id, current_user_id,
               new_values={"descricao": item.descricao, "quantidade": item.quantidade})

        db.commit()
        db.refresh(item)
        return _calc_item_totals(item)

    @staticmethod
    def remove_item(
        db: Session,
        cotacao_id: UUID,
        item_id: UUID,
        current_user_id: UUID,
    ) -> None:
        item = db.query(ItemCotacao).filter(
            ItemCotacao.id == item_id,
            ItemCotacao.id_cotacao == cotacao_id,
        ).first()
        if not item:
            raise NotFoundException(f"Item {item_id} não encontrado na cotação {cotacao_id}")

        _audit(db, AuditAction.DELETE, item.id, current_user_id,
               old_values={"descricao": item.descricao, "quantidade": item.quantidade})

        db.delete(item)
        db.commit()
