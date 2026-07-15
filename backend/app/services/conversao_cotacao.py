from datetime import date
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.cotacao import Cotacao
from app.models.cliente import Cliente
from app.models.pedido import Pedido
from app.models.status_history import StatusHistory, EntityType
from app.models.audit_log import AuditLog, AuditAction
from app.services.pedido import _generate_numero_os
from app.utils.errors import NotFoundException, BusinessLogicException


class ConversaoCotacaoService:

    @staticmethod
    def convert_to_pedido(
        db: Session,
        cotacao_id: UUID,
        current_user_id: UUID,
    ) -> Pedido:
        cotacao = db.query(Cotacao).filter(
            Cotacao.id == cotacao_id,
            Cotacao.deleted_at.is_(None),
        ).first()
        if not cotacao:
            raise NotFoundException(f"Cotação {cotacao_id} não encontrada")

        if cotacao.status_caida:
            raise BusinessLogicException("Cotação caída não pode ser convertida em pedido")
        if cotacao.status_fechada:
            raise BusinessLogicException("Cotação já foi convertida em pedido anteriormente")

        # Resolve client: find by CNPJ or name; create if not found
        if cotacao.cnpj_cliente:
            cliente = db.query(Cliente).filter(Cliente.cnpj == cotacao.cnpj_cliente).first()
            if not cliente:
                cliente = Cliente(nome=cotacao.cliente, cnpj=cotacao.cnpj_cliente)
                db.add(cliente)
                db.flush()
        else:
            cliente = db.query(Cliente).filter(Cliente.nome == cotacao.cliente).first()
            if not cliente:
                cliente = Cliente(nome=cotacao.cliente)
                db.add(cliente)
                db.flush()

        numero_os = _generate_numero_os(db)

        pedido = Pedido(
            id_loja=cotacao.id_loja,
            id_vendedor=cotacao.id_vendedor,
            id_cliente=cliente.id,
            id_cotacao=cotacao.id,
            numero_os=numero_os,
            numero_nf=None,
            data_pedido=date.today(),
            data_entrega=cotacao.data_prevista_fechamento or date.today(),
            status="To Buy",
            is_direct_billing=cotacao.is_direct_billing,
            fornecedor_principal=cotacao.fornecedor,
            observacao=cotacao.observacao,
            created_by=current_user_id,
        )
        db.add(pedido)
        db.flush()

        db.add(StatusHistory(
            entity_type=EntityType.PEDIDO,
            entity_id=pedido.id,
            old_status=None,
            new_status="To Buy",
            changed_by=current_user_id,
            reason=f"Criado a partir da cotação {cotacao.numero_requisicao or cotacao_id}",
        ))

        db.add(AuditLog(
            entity_type="pedido",
            entity_id=pedido.id,
            action=AuditAction.CREATE,
            changed_by=current_user_id,
            new_values={
                "numero_os": numero_os,
                "origem": "cotacao",
                "cotacao_id": str(cotacao_id),
            },
        ))

        cotacao.status_fechada = True
        cotacao.data_fechamento = date.today()
        if cotacao.valor_total and not cotacao.valor_fechamento:
            cotacao.valor_fechamento = cotacao.valor_total

        db.add(AuditLog(
            entity_type="cotacao",
            entity_id=cotacao.id,
            action=AuditAction.UPDATE,
            changed_by=current_user_id,
            old_values={"status_fechada": False},
            new_values={"status_fechada": True, "pedido_id": str(pedido.id)},
        ))

        db.commit()
        db.refresh(pedido)
        return pedido
