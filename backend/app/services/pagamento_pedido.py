from uuid import UUID
from sqlalchemy.orm import Session

from app.models.pedido import PedidoFormaPagamento
from app.schemas.pedido import FormaPagamentoIn
from app.services.pedido import PedidoService
from app.models.audit_log import AuditLog, AuditAction
from app.utils.errors import NotFoundException


class PagamentoPedidoService:

    @staticmethod
    def add_payment_method(
        db: Session, pedido_id: UUID, data: FormaPagamentoIn, current_user_id: UUID
    ) -> PedidoFormaPagamento:
        PedidoService.get_by_id(db, pedido_id)  # valida que pedido existe

        fp = PedidoFormaPagamento(id_pedido=pedido_id, forma=data.forma)
        db.add(fp)
        db.flush()

        db.add(AuditLog(
            entity_type="pagamento_pedido",
            entity_id=fp.id,
            action=AuditAction.CREATE,
            changed_by=current_user_id,
            new_values={"forma": data.forma},
        ))

        db.commit()
        db.refresh(fp)
        return fp
