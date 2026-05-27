from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.despesa import Despesa
from app.schemas.despesa import DespesaCreate, DespesaUpdate
from app.utils.errors import NotFoundException


class DespesaService:

    @staticmethod
    def list(db: Session) -> list[Despesa]:
        return (
            db.query(Despesa)
            .filter(Despesa.deleted_at.is_(None))
            .order_by(Despesa.created_at.desc())
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, despesa_id: UUID) -> Despesa:
        despesa = db.query(Despesa).filter(
            Despesa.id == despesa_id,
            Despesa.deleted_at.is_(None),
        ).first()
        if not despesa:
            raise NotFoundException(f"Despesa {despesa_id} não encontrada")
        return despesa

    @staticmethod
    def create(db: Session, data: DespesaCreate, current_user_id: UUID) -> Despesa:
        payload = data.model_dump()
        if payload.get('plano_parcelas'):
            payload['plano_parcelas'] = [p.model_dump() if hasattr(p, 'model_dump') else p
                                         for p in payload['plano_parcelas']]
        despesa = Despesa(**payload, created_by=current_user_id)
        db.add(despesa)
        db.commit()
        db.refresh(despesa)
        return despesa

    @staticmethod
    def update(db: Session, despesa_id: UUID, data: DespesaUpdate, current_user_id: UUID) -> Despesa:
        despesa = DespesaService.get_by_id(db, despesa_id)
        payload = data.model_dump(exclude_none=True)
        if 'plano_parcelas' in payload and payload['plano_parcelas']:
            payload['plano_parcelas'] = [p.model_dump() if hasattr(p, 'model_dump') else p
                                         for p in payload['plano_parcelas']]
        for field, value in payload.items():
            setattr(despesa, field, value)
        db.commit()
        db.refresh(despesa)
        return despesa

    @staticmethod
    def delete(db: Session, despesa_id: UUID, current_user_id: UUID) -> None:
        despesa = DespesaService.get_by_id(db, despesa_id)
        despesa.deleted_at = datetime.now(timezone.utc)
        db.commit()
