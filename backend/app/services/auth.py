from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse
from app.utils.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, verify_token, generate_totp_secret,
    verify_totp, get_totp_provisioning_uri
)
from app.utils.errors import AuthenticationException, NotFoundException


class AuthService:
    """Authentication service."""
    
    @staticmethod
    def register_user(
        db: Session,
        user_data: UserCreate,
        current_user: User = None
    ) -> User:
        """Register new user (admin only)."""
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise ValueError(f"User with email {user_data.email} already exists")
        
        # Create new user
        hashed_password = hash_password(user_data.password)
        
        user = User(
            email=user_data.email,
            name=user_data.name,
            password_hash=hashed_password,
            role=user_data.role,
            created_by=current_user.id if current_user else None
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return user
    
    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> User:
        """Authenticate user with email and password."""
        user = db.query(User).filter(User.email == email).first()
        
        if not user or not verify_password(password, user.password_hash):
            raise AuthenticationException("Invalid email or password")
        
        if not user.is_active:
            raise AuthenticationException("User is inactive")
        
        return user
    
    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> User:
        """Get user by ID."""
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise NotFoundException(f"User {user_id} not found")
        
        return user
    
    @staticmethod
    def setup_totp(db: Session, user_id: str) -> dict:
        """Setup TOTP for user."""
        user = AuthService.get_user_by_id(db, user_id)
        
        secret = generate_totp_secret()
        provisioning_uri = get_totp_provisioning_uri(secret, user.email)
        
        # Store secret temporarily (not enabled yet)
        user.totp_secret = secret
        db.commit()
        
        return {
            "secret": secret,
            "provisioning_uri": provisioning_uri,
            "qr_code_url": f"https://qr.server.com/?chl={provisioning_uri}"  # Placeholder
        }
    
    @staticmethod
    def verify_totp_setup(db: Session, user_id: str, token: str) -> bool:
        """Verify TOTP setup."""
        user = AuthService.get_user_by_id(db, user_id)
        
        if not user.totp_secret:
            raise ValueError("TOTP setup not initiated")
        
        if not verify_totp(user.totp_secret, token):
            raise AuthenticationException("Invalid TOTP token")
        
        # Enable TOTP
        user.totp_enabled = True
        db.commit()
        
        return True
    
    @staticmethod
    def create_tokens(user: User) -> dict:
        """Create access and refresh tokens."""
        access_token = create_access_token(subject=str(user.id))
        refresh_token = create_refresh_token(subject=str(user.id))
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
    
    @staticmethod
    def refresh_access_token(refresh_token: str) -> dict:
        """Refresh access token using refresh token."""
        user_id = verify_token(refresh_token)
        
        if not user_id:
            raise AuthenticationException("Invalid or expired refresh token")
        
        access_token = create_access_token(subject=user_id)
        
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
    
    @staticmethod
    def logout_user(db: Session, user_id: str) -> bool:
        """Logout user (can implement token blacklist if needed)."""
        # For now, logout is handled on frontend by removing tokens
        # In production, implement token blacklist
        return True
