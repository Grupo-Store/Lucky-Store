from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Header, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import (
    ChangePasswordRequest,
    EmailCodeVerifyRequest,
    LoginResponse,
    ResendCodeRequest,
    TOTPSetupResponse,
    TOTPVerifyRequest,
    TokenRefreshRequest,
    TokenRefreshResponse,
    UserCreate,
    UserResponse,
    UserLogin,
)
from app.services.auth import AuthService
from app.services.email import send_verification_email
from app.utils.errors import AuthenticationException, to_http_exception
from app.core.dependencies import get_current_user
from app.core.blacklist import blacklist_token
from app.core.rate_limit import check_rate_limit

get_current_user_dep = get_current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    user_count = db.query(User).count()
    if user_count > 0:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")
        from app.core.blacklist import is_blacklisted
        from app.utils.security import verify_token
        token = authorization.removeprefix("Bearer ")
        if is_blacklisted(token):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão encerrada. Faça login de novo.")
        user_id = verify_token(token, expected_type="access")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão expirada. Faça login de novo.")
    try:
        return AuthService.register_user(db, user_data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/login")
async def login(
    credentials: UserLogin,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        user = AuthService.authenticate_user(db, credentials.email, credentials.password)
    except AuthenticationException as exc:
        raise to_http_exception(exc)

    code = AuthService.create_email_verification_code(db, str(user.id))
    background_tasks.add_task(send_verification_email, user.email, user.name, code)

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"detail": {"requires_2fa": True, "user_id": str(user.id)}},
    )


@router.post("/resend-2fa", status_code=status.HTTP_200_OK)
async def resend_2fa(
    payload: ResendCodeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email).first()
    if user and user.is_active:
        code = AuthService.create_email_verification_code(db, str(user.id))
        background_tasks.add_task(send_verification_email, user.email, user.name, code)
    return {"detail": "Se o e-mail estiver cadastrado, um novo código foi enviado."}


@router.post("/verify-2fa", response_model=LoginResponse)
def verify_2fa(payload: EmailCodeVerifyRequest, db: Session = Depends(get_db)):
    check_rate_limit(f"verify_2fa:{payload.email}", max_attempts=5, window_seconds=300)
    try:
        user = AuthService.verify_email_code(db, payload.email, payload.code)
    except AuthenticationException as exc:
        raise to_http_exception(exc)

    tokens = AuthService.create_tokens(user)
    return LoginResponse(user=UserResponse.model_validate(user), **tokens)


@router.post("/refresh-token", response_model=TokenRefreshResponse)
def refresh_token(payload: TokenRefreshRequest):
    try:
        return AuthService.refresh_access_token(payload.refresh_token)
    except AuthenticationException as exc:
        raise to_http_exception(exc)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: LogoutRequest = LogoutRequest(),
    authorization: str | None = Header(default=None),
    current_user: User = Depends(get_current_user),
):
    if authorization and authorization.startswith("Bearer "):
        blacklist_token(authorization.removeprefix("Bearer "))
    if payload.refresh_token:
        blacklist_token(payload.refresh_token)


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


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
