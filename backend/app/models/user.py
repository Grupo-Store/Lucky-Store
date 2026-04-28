import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    """User roles for RBAC."""
    ADMIN = "admin"
    MANAGER = "manager"
    SELLER = "seller"
    VIEWER = "viewer"


class User(Base):
    """Users table."""
    __tablename__ = "users"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # User info
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # 2FA
    totp_secret = Column(String(32), nullable=True)  # TOTP secret for 2FA
    totp_enabled = Column(Boolean, default=False)
    
    # Role
    role = Column(SQLEnum(UserRole), default=UserRole.VIEWER, nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), nullable=True)  # Will reference user who created
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete
    
    def __repr__(self):
        return f"<User {self.email}>"
