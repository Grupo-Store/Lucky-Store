from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import (
    UserCreate, UserResponse, UserLogin, LoginResponse,
    TokenRefreshRequest, TokenRefreshResponse,
    TOTPSetupResponse, TOTPVerifyRequest, TOTPVerifyResponse,
)
from app.services.auth import AuthService
from app.utils.errors import AuthenticationException, AuthorizationException, to_http_exception
from app.utils.security import verify_token

router = APIRouter(prefix="/auth", tags=["auth"])


def get_current_user(token: str = Depends(lambda: None), db: Session = Depends(get_db)) -> User:
    raise NotImplementedError("Use get_current_user_from_header dependency instead")


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return authorization.removeprefix("Bearer ")


from fastapi import Header


def get_current_user_dep(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    token = _extract_bearer(authorization)
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    try:
        return AuthService.get_user_by_id(db, user_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))


def require_admin(current_user: User = Depends(get_current_user_dep)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        return AuthService.register_user(db, user_data, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/login", response_model=LoginResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    try:
        user = AuthService.authenticate_user(db, credentials.email, credentials.password)
    except AuthenticationException as exc:
        raise to_http_exception(exc)

    # If 2FA is enabled, return a partial response indicating 2FA is required
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

    from app.utils.security import verify_totp
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
def logout(current_user: User = Depends(get_current_user_dep), db: Session = Depends(get_db)):
    AuthService.logout_user(db, str(current_user.id))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user_dep)):
    return current_user


@router.post("/2fa/setup", response_model=TOTPSetupResponse)
def setup_2fa(current_user: User = Depends(get_current_user_dep), db: Session = Depends(get_db)):
    return AuthService.setup_totp(db, str(current_user.id))


@router.post("/2fa/confirm")
def confirm_2fa(payload: TOTPVerifyRequest, current_user: User = Depends(get_current_user_dep), db: Session = Depends(get_db)):
    try:
        AuthService.verify_totp_setup(db, str(current_user.id), payload.token)
        return {"detail": "2FA enabled successfully"}
    except (AuthenticationException, ValueError) as exc:
        detail = exc.detail if hasattr(exc, "detail") else str(exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
