import math
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.user import UserResponse
from app.schemas.audit_log import AuditLogResponse
from app.services.auth import AuthService
from app.services.lgpd import LgpdService
from app.api.routes.auth import get_current_user_dep, require_admin, get_current_user
from app.models.user import UserRole
from app.utils.errors import NotFoundException, to_http_exception
from pydantic import BaseModel


class UserDataExportResponse(BaseModel):
    user: UserResponse
    audit_logs: List[AuditLogResponse]

    class Config:
        from_attributes = True

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=dict)
def list_users(
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    items, total = AuthService.list_users(db, page=page, limit=limit)
    return {
        "items": [UserResponse.model_validate(u) for u in items],
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total else 0,
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user_dep)):
    return current_user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    try:
        return AuthService.get_user_by_id(db, str(user_id))
    except NotFoundException as exc:
        raise to_http_exception(exc)


@router.get("/{user_id}/data-export", response_model=UserDataExportResponse)
def export_user_data(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if str(current_user.id) != str(user_id) and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    audit_logs = (
        db.query(AuditLog)
        .filter(
            (AuditLog.changed_by == user_id) |
            ((AuditLog.entity_type == "user") & (AuditLog.entity_id == user_id))
        )
        .order_by(AuditLog.changed_at.desc())
        .all()
    )

    return UserDataExportResponse(
        user=UserResponse.model_validate(user),
        audit_logs=[AuditLogResponse.model_validate(log) for log in audit_logs],
    )


@router.delete("/{user_id}/delete-data", status_code=status.HTTP_200_OK)
def delete_user_data(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return LgpdService.delete_user_data(db, user_id, current_user.id)


@router.patch("/{user_id}/deactivate", response_model=UserResponse)
def deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        return AuthService.deactivate_user(db, str(user_id), current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except NotFoundException as exc:
        raise to_http_exception(exc)
