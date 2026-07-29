import logging
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _mail_config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_FROM_NAME="Portal Grupo Store",
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )


async def send_verification_email(email: str, name: str, code: str) -> None:
    message = MessageSchema(
        subject=f"{code} é o seu código de acesso — Portal Grupo Store",
        recipients=[email],
        body=f"""
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#18181b">
            <p style="margin:0 0 16px 0">Olá, <strong>{name}</strong>!</p>
            <p style="margin:0 0 24px 0">
                Use o código abaixo para acessar o <strong>Portal Grupo Store</strong>.
                Você solicitou esse código agora mesmo.
            </p>
            <div style="font-size:40px;font-weight:700;letter-spacing:12px;
                        text-align:center;padding:20px 16px;background:#f4f4f5;
                        border-radius:8px;margin:0 0 24px 0;color:#18181b">
                {code}
            </div>
            <p style="margin:0 0 8px 0;color:#52525b;font-size:13px">
                • Este código expira em <strong>{settings.EMAIL_CODE_EXPIRE_MINUTES} minutos</strong>.<br>
                • Se você não tentou fazer login, ignore este e-mail.<br>
                • Nunca compartilhe este código com ninguém.
            </p>
            <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
            <p style="margin:0;color:#a1a1aa;font-size:12px">
                Este é um e-mail automático do Portal Grupo Store. Não responda a esta mensagem.
            </p>
        </div>
        """,
        subtype=MessageType.html,
    )
    try:
        fm = FastMail(_mail_config())
        await fm.send_message(message)
        logger.info("E-mail de verificação enviado para %s", email)
    except Exception as exc:
        logger.error("Falha ao enviar e-mail para %s: %s", email, exc, exc_info=True)
        raise
