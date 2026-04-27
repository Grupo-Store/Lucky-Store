from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Optional
from app.models.user import UserRole


class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr
    name: str
    role: UserRole = UserRole.VIEWER


class UserCreate(UserBase):
    """User creation schema."""
    password: str
    
    class Config:
        from_attributes = True


class UserResponse(UserBase):
    """User response schema."""
    id: UUID
    is_active: bool
    totp_enabled: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    """User login schema."""
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Login response schema."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenRefreshRequest(BaseModel):
    """Token refresh request."""
    refresh_token: str


class TokenRefreshResponse(BaseModel):
    """Token refresh response."""
    access_token: str
    token_type: str = "bearer"


class TOTPSetupResponse(BaseModel):
    """TOTP setup response."""
    secret: str
    provisioning_uri: str
    qr_code_url: str


class TOTPVerifyRequest(BaseModel):
    """TOTP verification request."""
    token: str
    email: EmailStr


class TOTPVerifyResponse(BaseModel):
    """TOTP verification response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
