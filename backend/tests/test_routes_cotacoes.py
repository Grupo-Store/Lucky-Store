"""
Tests for cotacao routes:
  POST   /quotes
  GET    /quotes
  GET    /quotes/{id}
  PUT    /quotes/{id}
  PATCH  /quotes/{id}/phase
  DELETE /quotes/{id}
  POST   /quotes/{id}/items
  DELETE /quotes/{id}/items/{item_id}
  POST   /quotes/{id}/convert
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.api.routes.cotacoes import router as cotacoes_router
from app.api.routes.item_cotacao import router as item_cotacao_router
from app.api.routes.conversao_cotacao import router as conversao_router
from app.utils.errors import NotFoundException, BusinessLogicException


def _fake_cotacao(cotacao_id=None):
    c = MagicMock()
    c.id = cotacao_id or uuid.uuid4()
    c.id_loja = uuid.uuid4()
    c.id_vendedor = uuid.uuid4()
    c.numero = 1
    c.numero_requisicao = "REQ-001"
    c.b2b_company = None
    c.cliente = "Empresa Teste"
    c.cnpj_cliente = None
    c.data_cotacao = date.today()
    c.data_validade = None
    c.status_enviada = False
    c.data_envio = None
    c.status_em_fechamento = False
    c.data_prevista_fechamento = None
    c.status_fechada = False
    c.data_fechamento = None
    c.valor_fechamento = None
    c.status_caida = False
    c.data_queda = None
    c.is_direct_billing = False
    c.fornecedor = None
    c.valor_total = Decimal("5000.00")
    c.observacao = None
    c.pct_imposto_lucky = None
    c.pct_imposto_btech = None
    c.created_by = uuid.uuid4()
    c.created_at = datetime.now(timezone.utc)
    c.updated_at = datetime.now(timezone.utc)
    c.deleted_at = None
    c.itens = []
    return c


def _fake_item_cotacao(cotacao_id=None):
    item = MagicMock()
    item.id = uuid.uuid4()
    item.id_cotacao = cotacao_id or uuid.uuid4()
    item.descricao = "Notebook Dell"
    item.quantidade = 2
    item.valor_unitario = Decimal("3000.00")
    item.valor_fechamento = None
    item.fornecedor = None
    item.valor_total = None
    item.valor_total_fechamento = None
    item.porcentagem_fornecedor = None
    item.frete_fornecedor = None
    item.created_at = datetime.now(timezone.utc)
    item.updated_at = datetime.now(timezone.utc)
    return item


_COTACAO_PAYLOAD = {
    "id_loja": str(uuid.uuid4()),
    "id_vendedor": str(uuid.uuid4()),
    "cliente": "Empresa ABC",
    "data_cotacao": str(date.today()),
    "itens": [],
}

_ITEM_PAYLOAD = {
    "descricao": "Monitor 27\"",
    "quantidade": 1,
    "valor_unitario": "1500.00",
}


# ── POST /quotes ──────────────────────────────────────────────────────────────

class TestCreateQuote:

    def test_returns_201_on_success(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.create", return_value=_fake_cotacao()):
            resp = client.post("/quotes", json=_COTACAO_PAYLOAD)
        assert resp.status_code == 201

    def test_response_contains_cliente(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        fake = _fake_cotacao()
        fake.cliente = "Empresa ABC"
        with patch("app.api.routes.cotacoes.CotacaoService.create", return_value=fake):
            resp = client.post("/quotes", json=_COTACAO_PAYLOAD)
        assert resp.json()["cliente"] == "Empresa ABC"

    def test_returns_400_on_service_exception(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.create", side_effect=Exception("DB error")):
            resp = client.post("/quotes", json=_COTACAO_PAYLOAD)
        assert resp.status_code == 400


# ── GET /quotes ───────────────────────────────────────────────────────────────

class TestListQuotes:

    def test_returns_200_with_empty_list(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.list", return_value=([], 0, 0)):
            resp = client.get("/quotes")
        assert resp.status_code == 200
        assert resp.json()["items"] == []

    def test_returns_items_and_pagination(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.list",
                   return_value=([_fake_cotacao()], 1, 1)):
            resp = client.get("/quotes")
        body = resp.json()
        assert body["total"] == 1
        assert len(body["items"]) == 1

    def test_passes_filters_to_service(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.list",
                   return_value=([], 0, 0)) as mock_list:
            client.get("/quotes?cliente=Empresa&page=2")
        call_kwargs = mock_list.call_args.kwargs
        assert call_kwargs["cliente"] == "Empresa"
        assert call_kwargs["page"] == 2


# ── GET /quotes/{id} ──────────────────────────────────────────────────────────

class TestGetQuote:

    def test_returns_200_when_found(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.cotacoes.CotacaoService.get_by_id",
                   return_value=_fake_cotacao(cotacao_id)):
            resp = client.get(f"/quotes/{cotacao_id}")
        assert resp.status_code == 200

    def test_response_id_matches_path(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.cotacoes.CotacaoService.get_by_id",
                   return_value=_fake_cotacao(cotacao_id)):
            resp = client.get(f"/quotes/{cotacao_id}")
        assert resp.json()["id"] == str(cotacao_id)

    def test_returns_404_when_not_found(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.cotacoes.CotacaoService.get_by_id",
                   side_effect=NotFoundException("não encontrada")):
            resp = client.get(f"/quotes/{cotacao_id}")
        assert resp.status_code == 404


# ── PUT /quotes/{id} ──────────────────────────────────────────────────────────

class TestUpdateQuote:

    def test_returns_200_on_success(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.cotacoes.CotacaoService.update",
                   return_value=_fake_cotacao(cotacao_id)):
            resp = client.put(f"/quotes/{cotacao_id}", json={"cliente": "Novo Cliente"})
        assert resp.status_code == 200

    def test_returns_404_when_not_found(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.cotacoes.CotacaoService.update",
                   side_effect=NotFoundException("not found")):
            resp = client.put(f"/quotes/{cotacao_id}", json={"cliente": "X"})
        assert resp.status_code == 404

    def test_returns_400_on_service_exception(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.cotacoes.CotacaoService.update",
                   side_effect=Exception("unexpected")):
            resp = client.put(f"/quotes/{cotacao_id}", json={"cliente": "X"})
        assert resp.status_code == 400


# ── PATCH /quotes/{id}/phase ──────────────────────────────────────────────────

class TestUpdatePhase:

    def test_returns_200_when_marking_sent(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        cotacao_id = uuid.uuid4()
        fake = _fake_cotacao(cotacao_id)
        fake.status_enviada = True
        with patch("app.api.routes.cotacoes.CotacaoService.update_phase", return_value=fake):
            resp = client.patch(f"/quotes/{cotacao_id}/phase",
                                json={"status_enviada": True})
        assert resp.status_code == 200
        assert resp.json()["status_enviada"] is True

    def test_returns_404_when_not_found(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.cotacoes.CotacaoService.update_phase",
                   side_effect=NotFoundException("not found")):
            resp = client.patch(f"/quotes/{cotacao_id}/phase",
                                json={"status_enviada": True})
        assert resp.status_code == 404

    def test_returns_400_on_business_logic_error(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.cotacoes.CotacaoService.update_phase",
                   side_effect=BusinessLogicException("fase inválida")):
            resp = client.patch(f"/quotes/{cotacao_id}/phase",
                                json={"status_caida": True})
        assert resp.status_code == 400


# ── DELETE /quotes/{id} ───────────────────────────────────────────────────────

class TestDeleteQuote:

    def test_returns_204_on_success(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.cotacoes.CotacaoService.soft_delete", return_value=None):
            resp = client.delete(f"/quotes/{cotacao_id}")
        assert resp.status_code == 204

    def test_returns_404_when_not_found(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.cotacoes.CotacaoService.soft_delete",
                   side_effect=NotFoundException("not found")):
            resp = client.delete(f"/quotes/{cotacao_id}")
        assert resp.status_code == 404


# ── POST /quotes/{id}/items ───────────────────────────────────────────────────

class TestAddQuoteItem:

    def test_returns_201_on_success(self, make_test_client, mock_db):
        client = make_test_client(item_cotacao_router)
        cotacao_id = uuid.uuid4()
        fake_item = _fake_item_cotacao(cotacao_id)
        with patch("app.api.routes.item_cotacao.ItemCotacaoService.add_item",
                   return_value=fake_item):
            resp = client.post(f"/quotes/{cotacao_id}/items", json=_ITEM_PAYLOAD)
        assert resp.status_code == 201

    def test_response_contains_item_fields(self, make_test_client, mock_db):
        client = make_test_client(item_cotacao_router)
        cotacao_id = uuid.uuid4()
        fake_item = _fake_item_cotacao(cotacao_id)
        fake_item.descricao = "Monitor 27\""
        with patch("app.api.routes.item_cotacao.ItemCotacaoService.add_item",
                   return_value=fake_item):
            resp = client.post(f"/quotes/{cotacao_id}/items", json=_ITEM_PAYLOAD)
        assert resp.json()["descricao"] == "Monitor 27\""

    def test_returns_404_when_quote_not_found(self, make_test_client, mock_db):
        client = make_test_client(item_cotacao_router)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.item_cotacao.ItemCotacaoService.add_item",
                   side_effect=NotFoundException("not found")):
            resp = client.post(f"/quotes/{cotacao_id}/items", json=_ITEM_PAYLOAD)
        assert resp.status_code == 404

    def test_returns_422_when_quantidade_zero(self, make_test_client, mock_db):
        client = make_test_client(item_cotacao_router)
        cotacao_id = uuid.uuid4()
        resp = client.post(f"/quotes/{cotacao_id}/items",
                           json={**_ITEM_PAYLOAD, "quantidade": 0})
        assert resp.status_code == 422


# ── DELETE /quotes/{id}/items/{item_id} ───────────────────────────────────────

class TestRemoveQuoteItem:

    def test_returns_204_on_success(self, make_test_client, mock_db):
        client = make_test_client(item_cotacao_router)
        cotacao_id = uuid.uuid4()
        item_id = uuid.uuid4()
        with patch("app.api.routes.item_cotacao.ItemCotacaoService.remove_item",
                   return_value=None):
            resp = client.delete(f"/quotes/{cotacao_id}/items/{item_id}")
        assert resp.status_code == 204

    def test_returns_404_when_not_found(self, make_test_client, mock_db):
        client = make_test_client(item_cotacao_router)
        cotacao_id = uuid.uuid4()
        item_id = uuid.uuid4()
        with patch("app.api.routes.item_cotacao.ItemCotacaoService.remove_item",
                   side_effect=NotFoundException("not found")):
            resp = client.delete(f"/quotes/{cotacao_id}/items/{item_id}")
        assert resp.status_code == 404


# ── POST /quotes/{id}/convert ─────────────────────────────────────────────────

class TestConvertQuote:

    def _make_client(self, mock_db, fake_user):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from app.database import get_db
        from app.api.routes.auth import get_current_user_dep

        app = FastAPI()
        app.include_router(conversao_router)
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user_dep] = lambda: fake_user
        return TestClient(app)

    def test_returns_201_on_success(self, mock_db, fake_user):
        client = self._make_client(mock_db, fake_user)
        cotacao_id = uuid.uuid4()
        pedido_id = uuid.uuid4()
        fake_pedido = MagicMock()
        fake_pedido.id = pedido_id

        with patch("app.api.routes.conversao_cotacao.ConversaoCotacaoService.convert_to_pedido",
                   return_value=fake_pedido):
            resp = client.post(f"/quotes/{cotacao_id}/convert")

        assert resp.status_code == 201

    def test_response_contains_pedido_and_cotacao_ids(self, mock_db, fake_user):
        client = self._make_client(mock_db, fake_user)
        cotacao_id = uuid.uuid4()
        pedido_id = uuid.uuid4()
        fake_pedido = MagicMock()
        fake_pedido.id = pedido_id

        with patch("app.api.routes.conversao_cotacao.ConversaoCotacaoService.convert_to_pedido",
                   return_value=fake_pedido):
            resp = client.post(f"/quotes/{cotacao_id}/convert")

        body = resp.json()
        assert body["id_pedido"] == str(pedido_id)
        assert body["id_cotacao"] == str(cotacao_id)

    def test_returns_404_when_quote_not_found(self, mock_db, fake_user):
        client = self._make_client(mock_db, fake_user)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.conversao_cotacao.ConversaoCotacaoService.convert_to_pedido",
                   side_effect=NotFoundException("não encontrada")):
            resp = client.post(f"/quotes/{cotacao_id}/convert")
        assert resp.status_code == 404

    def test_returns_400_on_business_logic_error(self, mock_db, fake_user):
        client = self._make_client(mock_db, fake_user)
        cotacao_id = uuid.uuid4()
        with patch("app.api.routes.conversao_cotacao.ConversaoCotacaoService.convert_to_pedido",
                   side_effect=BusinessLogicException("cotação não está fechada")):
            resp = client.post(f"/quotes/{cotacao_id}/convert")
        assert resp.status_code == 400
