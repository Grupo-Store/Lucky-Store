"""Script de diagnóstico SMTP — rode com: python test_email.py <destinatario@email.com>"""
import asyncio
import sys
import os
from pathlib import Path

# Lê o .env manualmente para não depender do cache do pydantic
env_path = Path(__file__).parent / ".env"
env = {}
for line in env_path.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()

MAIL_USERNAME = env.get("MAIL_USERNAME", "")
MAIL_PASSWORD = env.get("MAIL_PASSWORD", "").replace(" ", "")
MAIL_FROM     = env.get("MAIL_FROM", "")
MAIL_SERVER   = env.get("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT     = int(env.get("MAIL_PORT", "587"))

print(f"Usando: {MAIL_USERNAME} / senha={MAIL_PASSWORD!r} / servidor={MAIL_SERVER}:{MAIL_PORT}")

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

async def main(to: str):
    conf = ConnectionConfig(
        MAIL_USERNAME=MAIL_USERNAME,
        MAIL_PASSWORD=MAIL_PASSWORD,
        MAIL_FROM=MAIL_FROM,
        MAIL_FROM_NAME="Orderly Hub (teste)",
        MAIL_PORT=MAIL_PORT,
        MAIL_SERVER=MAIL_SERVER,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )
    msg = MessageSchema(
        subject="Orderly Hub — teste SMTP",
        recipients=[to],
        body="<p>Se chegou aqui, o disparo de e-mail está funcionando.</p>",
        subtype=MessageType.html,
    )
    fm = FastMail(conf)
    await fm.send_message(msg)
    print(f"✓ E-mail enviado para {to}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python test_email.py <destinatario@email.com>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
