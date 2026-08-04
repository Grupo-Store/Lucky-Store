#!/usr/bin/env python3
"""
Smart migration runner.
- Fresh DB (no 'users' table): create_all + alembic stamp head
- Existing DB: alembic upgrade head
"""
import os
import sys

url = os.environ.get("DATABASE_URL", "")
if not url:
    print("ERROR: DATABASE_URL not set", file=sys.stderr)
    sys.exit(1)

if url.startswith("postgresql://"):
    url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    os.environ["DATABASE_URL"] = url

print(f"DATABASE_URL scheme: {url[:30]}...")

from sqlalchemy import create_engine, text

engine = create_engine(url, pool_pre_ping=True)

try:
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT EXISTS ("
            "  SELECT FROM information_schema.tables"
            "  WHERE table_schema = 'public' AND table_name = 'users'"
            ")"
        ))
        has_users = result.scalar()
except Exception as e:
    print(f"ERROR connecting to database: {e}", file=sys.stderr)
    sys.exit(1)

if not has_users:
    print("Fresh database detected — running create_all + stamp head")

    from app.database import Base
    import app.models.user
    import app.models.loja
    import app.models.vendedor
    import app.models.cliente
    import app.models.pedido
    import app.models.produto
    import app.models.cotacao
    import app.models.item_cotacao
    import app.models.rma
    import app.models.item_rma
    import app.models.compra_vendedor
    import app.models.venda_vendedor
    import app.models.meta_vendedor
    import app.models.audit_log
    import app.models.status_history
    import app.models.email_verification
    import app.models.dashboard_goal
    import app.models.expense
    import app.models.despesa

    Base.metadata.create_all(engine)
    print("All tables created successfully")

    try:
        from alembic.config import Config
        from alembic import command as alembic_command
        cfg = Config("alembic.ini")
        alembic_command.stamp(cfg, "head")
        print("Database stamped at head")
    except Exception as e:
        # Race condition: another instance already stamped — that's OK
        print(f"Stamp warning (may be a concurrent instance): {e}")
else:
    print("Existing database — running alembic upgrade head")
    try:
        from alembic.config import Config
        from alembic import command as alembic_command
        cfg = Config("alembic.ini")
        alembic_command.upgrade(cfg, "head")
        print("Migrations complete")
    except Exception as e:
        print(f"Migration error: {e}", file=sys.stderr)
        sys.exit(1)
