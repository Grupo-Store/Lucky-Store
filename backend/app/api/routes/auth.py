from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserCreate, UserResponse, UserLogin, LoginResponse,
    TokenRefreshRequest, TokenRefreshResponse,
    TOTPSetupResponse, TOTPVerifyRequest, TOTPVerifyResponse,
    ChangePasswordRequest,
)
from app.services.auth import AuthService
from app.utils.errors import AuthenticationException, to_http_exception
from app.utils.security import verify_totp
from app.core.dependencies import get_current_user
from app.core.blacklist import blacklist_token

get_current_user_dep = get_current_user
require_admin = get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    # Bootstrap: first user can register without auth
    user_count = db.query(User).count()
    if user_count > 0:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        from app.core.dependencies import get_current_user as _get
        from app.core.blacklist import is_blacklisted
        from app.utils.security import verify_token
        token = authorization.removeprefix("Bearer ")
        if is_blacklisted(token):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")
        user_id = verify_token(token, expected_type="access")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    try:
        return AuthService.register_user(db, user_data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/login", response_model=LoginResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    try:
        user = AuthService.authenticate_user(db, credentials.email, credentials.password)
    except AuthenticationException as exc:
        raise to_http_exception(exc)

    if user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail={"requires_2fa": True, "user_id": str(user.id)},
        )

    tokens = AuthService.create_tokens(user)
    return LoginResponse(user=UserResponse.model_validate(user), **tokens)


@router.post("/verify-2fa", response_model=TOTPVerifyResponse)
def verify_2fa(payload: TOTPVerifyRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.totp_secret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or 2FA not set up")
    if not verify_totp(user.totp_secret, payload.token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid 2FA token")

    tokens = AuthService.create_tokens(user)
    return TOTPVerifyResponse(user=UserResponse.model_validate(user), **tokens)


@router.post("/refresh-token", response_model=TokenRefreshResponse)
def refresh_token(payload: TokenRefreshRequest):
    try:
        return AuthService.refresh_access_token(payload.refresh_token)
    except AuthenticationException as exc:
        raise to_http_exception(exc)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    authorization: str | None = Header(default=None),
    current_user: User = Depends(get_current_user),
):
    if authorization and authorization.startswith("Bearer "):
        blacklist_token(authorization.removeprefix("Bearer "))


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        AuthService.change_password(db, str(current_user.id), payload.current_password, payload.new_password)
    except Exception as exc:
        raise to_http_exception(exc)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    try:
        AuthService.change_password(db, str(current_user.id), payload.current_password, payload.new_password)
    except Exception as exc:
        raise to_http_exception(exc)


@router.post("/2fa/setup", response_model=TOTPSetupResponse)
def setup_2fa(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return AuthService.setup_totp(db, str(current_user.id))


@router.post("/2fa/confirm")
def confirm_2fa(
    payload: TOTPVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        AuthService.verify_totp_setup(db, str(current_user.id), payload.token)
        return {"detail": "2FA enabled successfully"}
    except (AuthenticationException, ValueError) as exc:
        detail = exc.detail if hasattr(exc, "detail") else str(exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
