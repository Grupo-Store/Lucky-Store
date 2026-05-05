import math
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc

from app.models.cotacao import Cotacao
from app.models.item_cotacao import ItemCotacao
from app.models.audit_log import AuditLog, AuditAction
from app.schemas.cotacao import CotacaoCreate, CotacaoUpdate, PhaseUpdate
from app.utils.errors import NotFoundException


def _audit(db: Session, action: AuditAction, entity_id, changed_by: UUID,
           old_values: dict = None, new_values: dict = None):
    db.add(AuditLog(
        entity_type="cotacao",
        entity_id=entity_id,
        action=action,
        changed_by=changed_by,
        old_values=old_values,
        new_values=new_values,
    ))


def _calc_item_totals(item: ItemCotacao) -> ItemCotacao:
    item.valor_total = (
        Decimal(item.quantidade) * item.valor_unitario
        if item.valor_unitario is not None else None
    )
    item.valor_total_fechamento = (
        Decimal(item.quantidade) * item.valor_fechamento
        if item.valor_fechamento is not None else None
    )
    return item


def _hydrate_cotacao(cotacao: Cotacao) -> Cotacao:
    for item in cotacao.itens:
        _calc_item_totals(item)
    return cotacao


class CotacaoService:

    @staticmethod
    def create(db: Session, data: CotacaoCreate, current_user_id: UUID) -> Cotacao:
        cotacao = Cotacao(
            id_loja=data.id_loja,
            id_vendedor=data.id_vendedor,
            numero_requisicao=data.numero_requisicao,
            b2b_company=data.b2b_company,
            cliente=data.cliente,
            cnpj_cliente=data.cnpj_cliente,
            data_cotacao=data.data_cotacao,
            data_validade=data.data_validade,
            is_direct_billing=data.is_direct_billing,
            fornecedor=data.fornecedor,
            valor_total=data.valor_total,
            observacao=data.observacao,
            pct_imposto_lucky=data.pct_imposto_lucky,
            pct_imposto_btech=data.pct_imposto_btech,
            created_by=current_user_id,
        )
        db.add(cotacao)
        db.flush()

        for item_data in data.itens:
            db.add(ItemCotacao(
                id_cotacao=cotacao.id,
                descricao=item_data.descricao,
                quantidade=item_data.quantidade,
                valor_unitario=item_data.valor_unitario,
                valor_fechamento=item_data.valor_fechamento,
                fornecedor=item_data.fornecedor,
            ))

        _audit(db, AuditAction.CREATE, cotacao.id, current_user_id,
               new_values={"cliente": cotacao.cliente, "numero_requisicao": cotacao.numero_requisicao})

        db.commit()
        db.refresh(cotacao)
        return _hydrate_cotacao(cotacao)

    @staticmethod
    def list(
        db: Session,
        page: int = 1,
        limit: int = 20,
        id_loja: Optional[UUID] = None,
        id_vendedor: Optional[UUID] = None,
        cliente: Optional[str] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
        sort_by: str = "data_cotacao",
        sort_dir: str = "desc",
    ):
        q = db.query(Cotacao).filter(Cotacao.deleted_at.is_(None))

        if id_loja:
            q = q.filter(Cotacao.id_loja == id_loja)
        if id_vendedor:
            q = q.filter(Cotacao.id_vendedor == id_vendedor)
        if cliente:
            q = q.filter(Cotacao.cliente.ilike(f"%{cliente}%"))
        if data_inicio:
            q = q.filter(Cotacao.data_cotacao >= data_inicio)
        if data_fim:
            q = q.filter(Cotacao.data_cotacao <= data_fim)

        sort_col = getattr(Cotacao, sort_by, Cotacao.data_cotacao)
        q = q.order_by(desc(sort_col) if sort_dir == "desc" else asc(sort_col))

        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()

        for cotacao in items:
            _hydrate_cotacao(cotacao)

        return items, total, math.ceil(total / limit) if total else 0

    @staticmethod
    def get_by_id(db: Session, cotacao_id: UUID) -> Cotacao:
        cotacao = db.query(Cotacao).filter(
            Cotacao.id == cotacao_id,
            Cotacao.deleted_at.is_(None),
        ).first()
        if not cotacao:
            raise NotFoundException(f"Cotação {cotacao_id} não encontrada")
        return _hydrate_cotacao(cotacao)

    @staticmethod
    def update(db: Session, cotacao_id: UUID, data: CotacaoUpdate, current_user_id: UUID) -> Cotacao:
        cotacao = CotacaoService.get_by_id(db, cotacao_id)

        old_values = {
            "cliente": cotacao.cliente,
            "valor_total": str(cotacao.valor_total) if cotacao.valor_total else None,
        }

        for field, value in data.model_dump(exclude_none=True).items():
            setattr(cotacao, field, value)

        new_values = {
            "cliente": cotacao.cliente,
            "valor_total": str(cotacao.valor_total) if cotacao.valor_total else None,
        }

        _audit(db, AuditAction.UPDATE, cotacao.id, current_user_id,
               old_values=old_values, new_values=new_values)

        db.commit()
        db.refresh(cotacao)
        return _hydrate_cotacao(cotacao)

    @staticmethod
    def update_phase(db: Session, cotacao_id: UUID, data: PhaseUpdate, current_user_id: UUID) -> Cotacao:
        cotacao = CotacaoService.get_by_id(db, cotacao_id)

        old_values = {
            "status_enviada": cotacao.status_enviada,
            "status_em_fechamento": cotacao.status_em_fechamento,
            "status_fechada": cotacao.status_fechada,
            "status_caida": cotacao.status_caida,
        }

        for field, value in data.model_dump(exclude_none=True).items():
            setattr(cotacao, field, value)

        new_values = {
            "status_enviada": cotacao.status_enviada,
            "status_em_fechamento": cotacao.status_em_fechamento,
            "status_fechada": cotacao.status_fechada,
            "status_caida": cotacao.status_caida,
        }

        _audit(db, AuditAction.UPDATE, cotacao.id, current_user_id,
               old_values=old_values, new_values=new_values)

        db.commit()
        db.refresh(cotacao)
        return _hydrate_cotacao(cotacao)

    @staticmethod
    def soft_delete(db: Session, cotacao_id: UUID, current_user_id: UUID) -> None:
        cotacao = CotacaoService.get_by_id(db, cotacao_id)
        cotacao.deleted_at = datetime.now(timezone.utc)

        _audit(db, AuditAction.DELETE, cotacao.id, current_user_id,
               old_values={"cliente": cotacao.cliente})

        db.commit()
