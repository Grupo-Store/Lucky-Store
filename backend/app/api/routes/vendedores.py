from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.vendedor import Vendedor
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/vendedores", tags=["vendedores"])


class VendedorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nome: str
    email: Optional[str] = None
    id_loja: UUID


class VendedorCreate(BaseModel):
    nome: str
    email: Optional[EmailStr] = None
    id_loja: UUID


class VendedoresListResponse(BaseModel):
    items: list[VendedorOut]


@router.get("", response_model=VendedoresListResponse)
def list_vendedores(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    vendors = (
        db.query(Vendedor)
        .filter(Vendedor.deleted_at.is_(None))
        .order_by(Vendedor.nome)
        .all()
    )
    return {"items": vendors}


@router.post("", response_model=VendedorOut, status_code=status.HTTP_201_CREATED)
def create_vendedor(
    body: VendedorCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    existing = (
        db.query(Vendedor)
        .filter(
            Vendedor.id_loja == body.id_loja,
            Vendedor.nome == body.nome,
            Vendedor.deleted_at.is_(None),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vendedor '{body.nome}' já existe nesta loja",
        )

    vendor = Vendedor(id_loja=body.id_loja, nome=body.nome, email=body.email)
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor
