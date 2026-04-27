from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
import pyotp
from app.config import get_settings

settings = get_settings()

# Password hashing
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
)


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {
        "sub": subject,
        "exp": expire,
        "type": "access"
    }
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def create_refresh_token(subject: str) -> str:
    """Create JWT refresh token."""
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode = {
        "sub": subject,
        "exp": expire,
        "type": "refresh"
    }
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def verify_token(token: str) -> Optional[str]:
    """Verify JWT token and return subject."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        
        if user_id is None:
            return None
        
        return user_id
    except JWTError:
        return None


def generate_totp_secret() -> str:
    """Generate TOTP secret for 2FA."""
    return pyotp.random_base32()


def verify_totp(secret: str, token: str) -> bool:
    """Verify TOTP token."""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=settings.TOTP_WINDOW)


def get_totp_provisioning_uri(secret: str, email: str) -> str:
    """Get provisioning URI for TOTP setup."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(
        name=email,
        issuer_name=settings.TOTP_ISSUER
    )
