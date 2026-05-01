"""
Test configuration for Orderly Hub backend.

Strategy: no real database is used.  Before any app module is imported we:
  1. Set DATABASE_URL to a SQLite in-memory URL (avoids needing psycopg2).
  2. Monkey-patch sqlalchemy.create_engine to strip kwargs that SQLite does not
     support (pool_size, max_overflow) so app/database.py initialises cleanly.
"""
import os
import sys
import uuid

# ── 1. point to SQLite so psycopg2 is never loaded ──────────────────────────
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

# ── 2. patch create_engine BEFORE app.database is imported ──────────────────
import sqlalchemy as _sa  # noqa: E402

_real_create_engine = _sa.create_engine

_SQLITE_UNSUPPORTED = {"pool_size", "max_overflow"}


def _create_engine_patched(url, **kwargs):
    if str(url).startswith("sqlite"):
        for key in _SQLITE_UNSUPPORTED:
            kwargs.pop(key, None)
    return _real_create_engine(url, **kwargs)


_sa.create_engine = _create_engine_patched
# Also patch the symbol that sqlalchemy.engine.create references internally
import sqlalchemy.engine  # noqa: E402
sqlalchemy.engine.create_engine = _create_engine_patched  # type: ignore[attr-defined]

# ── 3. Now import app modules (engine will be created against SQLite) ─────────
import pytest  # noqa: E402
from unittest.mock import MagicMock  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.database import get_db  # noqa: E402
from app.api.routes.auth import get_current_user_dep  # noqa: E402
from app.models.user import UserRole  # noqa: E402

FAKE_USER_ID = uuid.uuid4()


class _FakeUser:
    id = FAKE_USER_ID
    email = "test@orderlyhub.com"
    role = UserRole.ADMIN


@pytest.fixture
def fake_user():
    return _FakeUser()


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def make_test_client(mock_db, fake_user):
    def _factory(router):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user_dep] = lambda: fake_user
        return TestClient(app)
    return _factory
