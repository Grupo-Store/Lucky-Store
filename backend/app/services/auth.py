import secrets
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.email_verification import EmailVerificationCode
from app.models.user import User
from app.schemas.user import UserCreate
from app.utils.errors import AuthenticationException, NotFoundException
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    generate_qr_code_base64,
    generate_totp_secret,
    get_totp_provisioning_uri,
    hash_password,
    verify_password,
    verify_token,
    verify_totp,
)

settings = get_settings()


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

    # ── Email 2FA ────────────────────────────────────────────────────────────

    @staticmethod
    def create_email_verification_code(db: Session, user_id: str) -> str:
        """Invalida códigos anteriores, gera um novo de 6 dígitos e persiste."""
        db.query(EmailVerificationCode).filter(
            EmailVerificationCode.user_id == user_id,
            EmailVerificationCode.used.is_(False),
        ).update({"used": True})

        code = "".join(secrets.choice(string.digits) for _ in range(6))
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.EMAIL_CODE_EXPIRE_MINUTES
        )
        record = EmailVerificationCode(user_id=user_id, code=code, expires_at=expires_at)
        db.add(record)
        db.commit()
        return code

    @staticmethod
    def verify_email_code(db: Session, email: str, code: str) -> User:
        """Valida o código de email e retorna o usuário se correto."""
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise AuthenticationException("Invalid email or code")

        now = datetime.now(timezone.utc)
        record = (
            db.query(EmailVerificationCode)
            .filter(
                EmailVerificationCode.user_id == user.id,
                EmailVerificationCode.code == code,
                EmailVerificationCode.used.is_(False),
                EmailVerificationCode.expires_at > now,
            )
            .order_by(EmailVerificationCode.created_at.desc())
            .first()
        )
        if not record:
            raise AuthenticationException("Invalid or expired code")

        record.used = True
        db.commit()
        return user

    # ── Tokens ───────────────────────────────────────────────────────────────

    @staticmethod
    def create_tokens(user: User) -> dict:
        return {
            "access_token": create_access_token(subject=str(user.id)),
            "refresh_token": create_refresh_token(subject=str(user.id)),
            "token_type": "bearer",
        }

    @staticmethod
    def refresh_access_token(refresh_token: str) -> dict:
        from app.core.blacklist import blacklist_token, is_blacklisted
        if is_blacklisted(refresh_token):
            raise AuthenticationException("Refresh token revogado")
        user_id = verify_token(refresh_token, expected_type="refresh")
        if not user_id:
            raise AuthenticationException("Invalid or expired refresh token")
        blacklist_token(refresh_token)
        return {
            "access_token": create_access_token(subject=user_id),
            "refresh_token": create_refresh_token(subject=user_id),
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

    # ── TOTP (legado — mantido para usuários com totp_enabled existente) ──────

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
