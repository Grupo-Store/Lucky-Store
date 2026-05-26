import uuid
from unittest.mock import MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.vendedores import router
from app.database import get_db
from app.api.routes.auth import get_current_user_dep


# ── Helpers ───────────────────────────────────────────────────────────────────

LOJA_ID = uuid.UUID("aa000001-0000-0000-0000-000000000001")


def _make_vendedor(nome="Alfredo", email="alfredo@lucky.com"):
    v = type("Vendedor", (), {})()
    v.id = uuid.uuid4()
    v.nome = nome
    v.email = email
    v.id_loja = LOJA_ID
    v.deleted_at = None
    return v


def _no_auth_client(mock_db):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: mock_db
    return TestClient(app, raise_server_exceptions=False)


# ── GET /vendedores ───────────────────────────────────────────────────────────

def test_list_returns_all_active_vendors(make_test_client, mock_db):
    v1 = _make_vendedor("Alfredo")
    v2 = _make_vendedor("João")

    chain = mock_db.query.return_value
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.all.return_value = [v1, v2]

    client = make_test_client(router)
    r = client.get("/vendedores")

    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 2
    assert items[0]["nome"] == "Alfredo"
    assert items[1]["nome"] == "João"


def test_list_requires_auth(mock_db):
    client = _no_auth_client(mock_db)
    r = client.get("/vendedores")
    assert r.status_code == 401


def test_list_empty(make_test_client, mock_db):
    chain = mock_db.query.return_value
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.all.return_value = []

    client = make_test_client(router)
    r = client.get("/vendedores")

    assert r.status_code == 200
    assert r.json()["items"] == []


# ── POST /vendedores ──────────────────────────────────────────────────────────

def test_create_vendor_success(make_test_client, mock_db):
    chain = mock_db.query.return_value
    chain.filter.return_value = chain
    chain.first.return_value = None  # no duplicate

    created = _make_vendedor("Carlos", "carlos@lucky.com")

    def refresh_side(obj):
        obj.id = created.id
        obj.nome = created.nome
        obj.email = created.email
        obj.id_loja = created.id_loja

    mock_db.refresh.side_effect = refresh_side

    client = make_test_client(router)
    r = client.post("/vendedores", json={
        "nome": "Carlos",
        "email": "carlos@lucky.com",
        "id_loja": str(LOJA_ID),
    })

    assert r.status_code == 201
    body = r.json()
    assert body["nome"] == "Carlos"
    assert body["email"] == "carlos@lucky.com"


def test_create_vendor_conflict(make_test_client, mock_db):
    existing = _make_vendedor("Alfredo")
    chain = mock_db.query.return_value
    chain.filter.return_value = chain
    chain.first.return_value = existing  # duplicate found

    client = make_test_client(router)
    r = client.post("/vendedores", json={
        "nome": "Alfredo",
        "id_loja": str(LOJA_ID),
    })

    assert r.status_code == 409
    assert "Alfredo" in r.json()["detail"]


def test_create_vendor_requires_auth(mock_db):
    client = _no_auth_client(mock_db)
    r = client.post("/vendedores", json={"nome": "X", "id_loja": str(LOJA_ID)})
    assert r.status_code == 401


def test_create_vendor_without_email(make_test_client, mock_db):
    chain = mock_db.query.return_value
    chain.filter.return_value = chain
    chain.first.return_value = None

    created = _make_vendedor("Marcos", None)

    def refresh_side(obj):
        obj.id = created.id
        obj.nome = created.nome
        obj.email = created.email
        obj.id_loja = created.id_loja

    mock_db.refresh.side_effect = refresh_side

    client = make_test_client(router)
    r = client.post("/vendedores", json={"nome": "Marcos", "id_loja": str(LOJA_ID)})

    assert r.status_code == 201
    assert r.json()["email"] is None


def test_list_returns_vendor_email_and_loja(make_test_client, mock_db):
    v = _make_vendedor("Beatriz", "beatriz@lucky.com")

    chain = mock_db.query.return_value
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.all.return_value = [v]

    client = make_test_client(router)
    r = client.get("/vendedores")

    assert r.status_code == 200
    item = r.json()["items"][0]
    assert item["email"] == "beatriz@lucky.com"
    assert item["id_loja"] == str(LOJA_ID)
