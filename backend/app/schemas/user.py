from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Optional
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.ADMIN


class UserCreate(UserBase):
    password: str

    class Config:
        from_attributes = True


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    totp_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TOTPSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    qr_code_url: str


class TOTPVerifyRequest(BaseModel):
    token: str
    email: EmailStr


class TOTPVerifyResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
