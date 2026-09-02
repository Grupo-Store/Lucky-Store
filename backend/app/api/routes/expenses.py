from datetime import datetime, timezone
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseListResponse, ExpenseResponse, ExpenseUpdate
from app.api.routes.auth import get_current_user_dep

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    expense = Expense(**data.model_dump(), created_by=current_user.id)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("", response_model=ExpenseListResponse)
def list_expenses(
    id_loja: UUID = Query(...),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    from datetime import date as date_type

    filters = [Expense.id_loja == id_loja, Expense.deleted_at.is_(None)]
    if data_inicio:
        filters.append(Expense.data_prevista >= date_type.fromisoformat(data_inicio))
    if data_fim:
        filters.append(Expense.data_prevista <= date_type.fromisoformat(data_fim))

    total = db.query(Expense).filter(*filters).count()
    items = (
        db.query(Expense)
        .filter(*filters)
        .order_by(Expense.data_prevista)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: UUID,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.deleted_at.is_(None))
        .first()
    )
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despesa não encontrada")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dep),
):
    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.deleted_at.is_(None))
        .first()
    )
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despesa não encontrada")

    expense.deleted_at = datetime.now(timezone.utc)
    db.commit()
