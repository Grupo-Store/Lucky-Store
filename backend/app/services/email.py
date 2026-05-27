from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.config import get_settings

settings = get_settings()


def _mail_config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_FROM_NAME=settings.APP_NAME,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )


async def send_verification_email(email: str, name: str, code: str) -> None:
    message = MessageSchema(
        subject="Orderly Hub — Código de verificação",
        recipients=[email],
        body=f"""
        <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">
            <h2 style="margin-bottom:8px">Código de verificação</h2>
            <p>Olá, <strong>{name}</strong>!</p>
            <p>Use o código abaixo para acessar o Orderly Hub:</p>
            <div style="font-size:36px;font-weight:bold;letter-spacing:10px;
                        text-align:center;padding:20px;background:#f4f4f5;
                        border-radius:8px;margin:20px 0">
                {code}
            </div>
            <p style="color:#71717a;font-size:13px">
                Expira em {settings.EMAIL_CODE_EXPIRE_MINUTES} minutos.
                Não compartilhe este código com ninguém.
            </p>
        </div>
        """,
        subtype=MessageType.html,
    )
    fm = FastMail(_mail_config())
    await fm.send_message(message)
