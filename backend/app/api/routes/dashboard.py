from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.dashboard import (
    DashboardKpisResponse,
    BreakdownByCompanyResponse,
    BreakdownBySellerResponse,
    GoalCreate,
    GoalResponse,
    GoalsListResponse,
    VendorGoalCreate,
    VendorGoalResponse,
    VendorGoalsListResponse,
    DailySeriesResponse,
    ProjectionsResponse,
)
from app.services import dashboard as svc

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _filters(
    mes: Optional[int] = Query(None, ge=1, le=12),
    ano: Optional[int] = Query(None, ge=2020, le=2100),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    id_loja: Optional[UUID] = Query(None),
) -> dict:
    return dict(mes=mes, ano=ano, data_inicio=data_inicio, data_fim=data_fim, id_loja=id_loja)


@router.get("/kpis", response_model=DashboardKpisResponse)
def get_kpis(
    f: dict = Depends(_filters),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_kpis(db, **f)


@router.get("/breakdown-by-company", response_model=BreakdownByCompanyResponse)
def breakdown_by_company(
    f: dict = Depends(_filters),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_breakdown_by_company(db, **f)


@router.get("/breakdown-by-seller", response_model=BreakdownBySellerResponse)
def breakdown_by_seller(
    f: dict = Depends(_filters),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_breakdown_by_seller(db, **f)


@router.get("/daily-series", response_model=DailySeriesResponse)
def get_daily_series(
    f: dict = Depends(_filters),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_daily_series(db, **f)


@router.get("/projections", response_model=ProjectionsResponse)
def get_projections(
    f: dict = Depends(_filters),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.get_projections(db, **f)


# ─── Goals ────────────────────────────────────────────────────────────────────

@router.get("/goals", response_model=GoalsListResponse)
def list_goals(
    ano: Optional[int] = Query(None, ge=2020, le=2100),
    mes: Optional[int] = Query(None, ge=1, le=12),
    id_loja: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.list_goals(db, ano=ano, mes=mes, id_loja=id_loja)


@router.post("/goals", response_model=GoalResponse, status_code=status.HTTP_200_OK)
def upsert_goal(
    payload: GoalCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.upsert_goal(db, payload)


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc.delete_goal(db, goal_id)


# ─── Vendor Goals ─────────────────────────────────────────────────────────────

@router.get("/vendor-goals", response_model=VendorGoalsListResponse)
def list_vendor_goals(
    ano: Optional[int] = Query(None, ge=2020, le=2100),
    mes: Optional[int] = Query(None, ge=1, le=12),
    id_vendedor: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.list_vendor_goals(db, ano=ano, mes=mes, id_vendedor=id_vendedor)


@router.post("/vendor-goals", response_model=VendorGoalResponse, status_code=status.HTTP_200_OK)
def upsert_vendor_goal(
    payload: VendorGoalCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return svc.upsert_vendor_goal(db, payload)


@router.delete("/vendor-goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor_goal(
    goal_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc.delete_vendor_goal(db, goal_id)
