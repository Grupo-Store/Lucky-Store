from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.utils.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, verify_token, generate_totp_secret,
    verify_totp, get_totp_provisioning_uri, generate_qr_code_base64,
)
from app.utils.errors import AuthenticationException, NotFoundException


class AuthService:

    @staticmethod
    def register_user(db: Session, user_data: UserCreate) -> User:
        existing = db.query(User).filter(User.email == user_data.email).first()
        if existing:
            raise ValueError(f"User with email {user_data.email} already exists")

        user = User(
            email=user_data.email,
            name=user_data.name,
            password_hash=hash_password(user_data.password),
            role=user_data.role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> User:
        user = db.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.password_hash):
            raise AuthenticationException("Invalid email or password")
        if not user.is_active:
            raise AuthenticationException("User is inactive")
        return user

    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise NotFoundException(f"User {user_id} not found")
        return user

    @staticmethod
    def setup_totp(db: Session, user_id: str) -> dict:
        user = AuthService.get_user_by_id(db, user_id)
        secret = generate_totp_secret()
        provisioning_uri = get_totp_provisioning_uri(secret, user.email)
        user.totp_secret = secret
        db.commit()
        return {
            "secret": secret,
            "provisioning_uri": provisioning_uri,
            "qr_code_url": generate_qr_code_base64(provisioning_uri),
        }

    @staticmethod
    def verify_totp_setup(db: Session, user_id: str, token: str) -> bool:
        user = AuthService.get_user_by_id(db, user_id)
        if not user.totp_secret:
            raise ValueError("TOTP setup not initiated")
        if not verify_totp(user.totp_secret, token):
            raise AuthenticationException("Invalid TOTP token")
        user.totp_enabled = True
        db.commit()
        return True

    @staticmethod
    def create_tokens(user: User) -> dict:
        return {
            "access_token": create_access_token(subject=str(user.id)),
            "refresh_token": create_refresh_token(subject=str(user.id)),
            "token_type": "bearer",
        }

    @staticmethod
    def refresh_access_token(refresh_token: str) -> dict:
        user_id = verify_token(refresh_token, expected_type="refresh")
        if not user_id:
            raise AuthenticationException("Invalid or expired refresh token")
        return {
            "access_token": create_access_token(subject=user_id),
            "token_type": "bearer",
        }

    @staticmethod
    def change_password(db: Session, user_id: str, current_password: str, new_password: str) -> None:
        user = AuthService.get_user_by_id(db, user_id)
        if not verify_password(current_password, user.password_hash):
            raise AuthenticationException("Senha atual incorreta")
        user.password_hash = hash_password(new_password)
        db.commit()

    @staticmethod
    def list_users(db: Session, page: int = 1, limit: int = 20):
        q = db.query(User).filter(User.deleted_at.is_(None))
        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()
        return items, total

    @staticmethod
    def deactivate_user(db: Session, user_id: str, current_user: User) -> User:
        if str(current_user.id) == user_id:
            raise ValueError("Não é possível desativar o próprio usuário")
        user = AuthService.get_user_by_id(db, user_id)
        user.is_active = False
        db.commit()
        db.refresh(user)
        return user
