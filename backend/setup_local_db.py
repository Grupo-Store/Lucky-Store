#!/usr/bin/env python3
"""
Cria o banco de dados local do Orderly Hub e aplica todas as migrações.

Pré-requisito: PostgreSQL instalado e rodando localmente.

Uso:
    cd backend
    python setup_local_db.py
"""

import os
import sys
import subprocess
from pathlib import Path
from urllib.parse import urlparse

BACKEND_DIR = Path(__file__).parent.resolve()
DB_NAME = "orderly_hub"


# ── Helpers de output ──────────────────────────────────────────────────────────

def _h(msg):    print(f"\n\033[1;34m▶  {msg}\033[0m")
def _ok(msg):   print(f"\033[0;32m   ✓ {msg}\033[0m")
def _warn(msg): print(f"\033[0;33m   ! {msg}\033[0m")
def _fail(msg):
    print(f"\033[0;31m   ✗ {msg}\033[0m")
    sys.exit(1)


# ── .env ───────────────────────────────────────────────────────────────────────

ENV_TEMPLATE = """\
# Application
APP_NAME=Orderly Hub API
APP_VERSION=1.0.0
APP_ENV=development
APP_DEBUG=True
LOG_LEVEL=DEBUG

# Database
DATABASE_URL=postgresql://postgres:{password}@localhost:5432/orderly_hub?client_encoding=utf8

# JWT — mude antes de subir para produção
JWT_SECRET=change-me-to-a-random-secret-at-least-32-chars-long
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:5173","http://localhost:8080"]

# 2FA
TOTP_ISSUER=OrderlyHub
TOTP_WINDOW=1

# Email (opcional — preencha se quiser usar 2FA por e-mail)
MAIL_USERNAME=seu_email@gmail.com
MAIL_PASSWORD=sua_app_password
MAIL_FROM=seu_email@gmail.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
EMAIL_CODE_EXPIRE_MINUTES=5
"""


def setup_env():
    _h("Arquivo .env")
    env_path = BACKEND_DIR / ".env"
    if env_path.exists():
        _ok(".env já existe — mantendo o existente.")
        return

    print("   Nenhum .env encontrado. Vamos criá-lo agora.")
    password = input("   Senha do usuário 'postgres' no seu PostgreSQL local [postgres]: ").strip()
    if not password:
        password = "postgres"

    env_path.write_text(ENV_TEMPLATE.format(password=password), encoding="utf-8")
    _ok(f".env criado em {env_path}")


def parse_db_url():
    """Lê DATABASE_URL do .env e retorna seus componentes."""
    env_path = BACKEND_DIR / ".env"
    url = "postgresql://postgres:postgres@localhost:5432/orderly_hub"

    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip()
                break

    parsed = urlparse(url)
    return {
        "user": parsed.username or "postgres",
        "password": parsed.password or "postgres",
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "dbname": (parsed.path or f"/{DB_NAME}").lstrip("/"),
    }


# ── Dependências ───────────────────────────────────────────────────────────────

def resolve_python():
    """Devolve o executável Python a usar (venv se existir, senão o atual)."""
    for candidate in [
        BACKEND_DIR / "venv" / "Scripts" / "python.exe",  # Windows
        BACKEND_DIR / "venv" / "bin" / "python",           # Unix
    ]:
        if candidate.exists():
            return str(candidate)
    return sys.executable


def install_deps(python):
    _h("Instalando dependências")
    req = BACKEND_DIR / "requirements.txt"
    result = subprocess.run(
        [python, "-m", "pip", "install", "-r", str(req), "-q", "--disable-pip-version-check"],
        cwd=BACKEND_DIR,
    )
    if result.returncode != 0:
        _fail("Falha ao instalar dependências. Verifique sua versão do Python e acesso à internet.")
    _ok("Dependências prontas.")


# ── Banco de dados ─────────────────────────────────────────────────────────────

def create_database(conn_info):
    _h(f"Criando banco '{conn_info['dbname']}'")

    try:
        import psycopg2
        from psycopg2 import sql
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    except ImportError:
        _fail("psycopg2 não encontrado. As dependências foram instaladas corretamente?")

    # Conecta ao banco de sistema 'postgres' para poder criar o banco alvo
    try:
        conn = psycopg2.connect(
            host=conn_info["host"],
            port=conn_info["port"],
            user=conn_info["user"],
            password=conn_info["password"],
            dbname="postgres",
            connect_timeout=5,
        )
    except psycopg2.OperationalError as e:
        _fail(
            f"Não foi possível conectar ao PostgreSQL: {e}\n\n"
            "   Verifique se:\n"
            "   • O PostgreSQL está instalado e rodando\n"
            "   • A senha no .env está correta\n"
            "   • O host/porta estão certos (padrão: localhost:5432)"
        )

    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    cur.execute(
        "SELECT 1 FROM pg_database WHERE datname = %s",
        (conn_info["dbname"],),
    )
    if cur.fetchone():
        _ok(f"Banco '{conn_info['dbname']}' já existe — nada a fazer.")
    else:
        cur.execute(sql.SQL("CREATE DATABASE {} ENCODING 'UTF8'").format(
            sql.Identifier(conn_info["dbname"])
        ))
        _ok(f"Banco '{conn_info['dbname']}' criado.")

    cur.close()
    conn.close()


# ── Migrações ──────────────────────────────────────────────────────────────────

def run_migrations(python):
    _h("Aplicando migrações (alembic upgrade head)")
    result = subprocess.run(
        [python, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
    )
    if result.returncode != 0:
        _fail(
            "Falha ao aplicar migrações.\n"
            "   Verifique se o banco existe e se o DATABASE_URL no .env está correto."
        )
    _ok("Todas as migrações aplicadas.")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("\n\033[1;37m════════════════════════════════════════════")
    print(  " Setup do banco local — Orderly Hub")
    print(  "════════════════════════════════════════════\033[0m")

    os.chdir(BACKEND_DIR)

    setup_env()

    conn_info = parse_db_url()

    python = resolve_python()
    install_deps(python)

    create_database(conn_info)
    run_migrations(python)

    print("\n\033[1;32m════════════════════════════════════════════")
    print(  " Banco configurado com sucesso!")
    print(  "════════════════════════════════════════════\033[0m")
    print("  Para iniciar o servidor:")
    print("    cd backend")
    print("    uvicorn main:app --reload\n")


if __name__ == "__main__":
    main()
