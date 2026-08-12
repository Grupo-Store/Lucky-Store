"""
Testes do autocomplete de cliente por CPF/CNPJ:
  GET /clientes/lookup
  GET /clientes
e da lógica compartilhada em app/services/cliente.py
"""
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.api.routes.clientes import router
from app.services.cliente import only_digits, upsert_cliente


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_cliente(nome="Tech Solutions", empresa="Tech Solutions Ltda",
                  cnpj="12.345.678/0001-90"):
    c = type("Cliente", (), {})()
    c.id = uuid.uuid4()
    c.nome = nome
    c.empresa = empresa
    c.cnpj = cnpj
    c.email = None
    c.phone = None
    c.address = None
    c.city = None
    c.state = None
    c.zip_code = None
    c.deleted_at = None
    return c


# ── only_digits ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("entrada,esperado", [
    ("12.345.678/0001-90", "12345678000190"),
    ("12345678000190", "12345678000190"),
    ("12.345.678/000190", "12345678000190"),
    ("  12345678000190  ", "12345678000190"),
    ("123.456.789-01", "12345678901"),
    ("", ""),
    (None, ""),
    ("abc", ""),
])
def test_only_digits_normaliza(entrada, esperado):
    assert only_digits(entrada) == esperado


def test_variacoes_de_pontuacao_convergem():
    """O mesmo CNPJ digitado de formas diferentes tem que virar a mesma chave."""
    variacoes = ["12.345.678/0001-90", "12345678000190", "12.345.678/000190"]
    assert len({only_digits(v) for v in variacoes}) == 1


# ── GET /clientes/lookup ──────────────────────────────────────────────────────

def test_lookup_retorna_cliente_encontrado(make_test_client, mock_db):
    cliente = _make_cliente()

    with patch("app.api.routes.clientes.find_cliente_by_documento",
               return_value=cliente):
        client = make_test_client(router)
        r = client.get("/clientes/lookup", params={"cnpj": "12.345.678/0001-90"})

    assert r.status_code == 200
    body = r.json()
    assert body["nome"] == "Tech Solutions"
    assert body["empresa"] == "Tech Solutions Ltda"


def test_lookup_encontra_ignorando_pontuacao(make_test_client, mock_db):
    """Digitar só números tem que achar o cliente salvo com pontuação."""
    cliente = _make_cliente()

    with patch("app.api.routes.clientes.find_cliente_by_documento",
               return_value=cliente) as mock_find:
        client = make_test_client(router)
        r = client.get("/clientes/lookup", params={"cnpj": "12345678000190"})

    assert r.status_code == 200
    assert r.json()["nome"] == "Tech Solutions"
    # A rota normaliza antes de consultar
    assert mock_find.call_args.args[1] == "12345678000190"


def test_lookup_retorna_null_quando_nao_existe(make_test_client, mock_db):
    """Cliente novo não é erro — o front trata null como 'siga digitando'."""
    with patch("app.api.routes.clientes.find_cliente_by_documento",
               return_value=None):
        client = make_test_client(router)
        r = client.get("/clientes/lookup", params={"cnpj": "99999999000199"})

    assert r.status_code == 200
    assert r.json() is None


@pytest.mark.parametrize("documento", ["123", "1234567890", "123456789012345"])
def test_lookup_ignora_documento_incompleto(make_test_client, mock_db, documento):
    """Só 11 (CPF) ou 14 (CNPJ) dígitos disparam consulta ao banco."""
    with patch("app.api.routes.clientes.find_cliente_by_documento") as mock_find:
        client = make_test_client(router)
        r = client.get("/clientes/lookup", params={"cnpj": documento})

    assert r.status_code == 200
    assert r.json() is None
    mock_find.assert_not_called()


def test_lookup_aceita_cpf(make_test_client, mock_db):
    cliente = _make_cliente(nome="João Silva", empresa=None, cnpj="123.456.789-01")

    with patch("app.api.routes.clientes.find_cliente_by_documento",
               return_value=cliente), \
         patch("app.api.routes.clientes._empresa_from_cotacoes", return_value=None):
        client = make_test_client(router)
        r = client.get("/clientes/lookup", params={"cnpj": "12345678901"})

    assert r.status_code == 200
    assert r.json()["nome"] == "João Silva"
    assert r.json()["empresa"] is None


def test_lookup_busca_empresa_na_cotacao_quando_cliente_nao_tem(make_test_client, mock_db):
    """Cliente cadastrado antes da coluna `empresa` existir."""
    cliente = _make_cliente(empresa=None)

    with patch("app.api.routes.clientes.find_cliente_by_documento",
               return_value=cliente), \
         patch("app.api.routes.clientes._empresa_from_cotacoes",
               return_value="Razão Social da Cotação"):
        client = make_test_client(router)
        r = client.get("/clientes/lookup", params={"cnpj": "12345678000190"})

    assert r.status_code == 200
    assert r.json()["empresa"] == "Razão Social da Cotação"


def test_lookup_exige_parametro_cnpj(make_test_client, mock_db):
    client = make_test_client(router)
    assert client.get("/clientes/lookup").status_code == 422


# ── upsert_cliente ────────────────────────────────────────────────────────────

def test_upsert_cria_quando_nao_existe(mock_db):
    with patch("app.services.cliente.find_cliente_by_documento", return_value=None):
        cliente = upsert_cliente(mock_db, "Contato", "12.345.678/0001-90", "Empresa Ltda")

    assert cliente.nome == "Contato"
    assert cliente.empresa == "Empresa Ltda"
    assert cliente.cnpj == "12.345.678/0001-90"
    mock_db.add.assert_called_once()


def test_upsert_atualiza_existente(mock_db):
    existente = _make_cliente(nome="Nome Antigo", empresa=None)

    with patch("app.services.cliente.find_cliente_by_documento", return_value=existente):
        cliente = upsert_cliente(mock_db, "Nome Novo", "12.345.678/0001-90", "Empresa Nova")

    assert cliente is existente
    assert cliente.nome == "Nome Novo"
    assert cliente.empresa == "Empresa Nova"
    mock_db.add.assert_not_called()


def test_upsert_nao_apaga_dado_bom_com_valor_vazio(mock_db):
    """Formulário preenchido pela metade não pode zerar o que já estava salvo."""
    existente = _make_cliente(nome="Contato Bom", empresa="Empresa Boa")

    with patch("app.services.cliente.find_cliente_by_documento", return_value=existente):
        upsert_cliente(mock_db, "", "12.345.678/0001-90", None)

    assert existente.nome == "Contato Bom"
    assert existente.empresa == "Empresa Boa"


def test_upsert_sem_nome_nem_documento_retorna_none(mock_db):
    with patch("app.services.cliente.find_cliente_by_documento", return_value=None):
        assert upsert_cliente(mock_db, "", None, None) is None
    mock_db.add.assert_not_called()


def test_upsert_nao_reescreve_o_cnpj_gravado(mock_db):
    """A coluna cnpj é UNIQUE. Se a base tiver dois registros com os mesmos
    dígitos e pontuação diferente, reformatar um faria colidir com o outro e
    derrubar o salvamento. O formato armazenado fica intocado."""
    existente = _make_cliente(cnpj="12345678000190")

    with patch("app.services.cliente.find_cliente_by_documento", return_value=existente):
        upsert_cliente(mock_db, "Contato", "12.345.678/0001-90", None)

    assert existente.cnpj == "12345678000190"


def test_upsert_nao_duplica_cliente_com_pontuacao_diferente(mock_db):
    """O bug que a normalização resolve: mesmo CNPJ, pontuação diferente."""
    existente = _make_cliente(cnpj="12345678000190")

    with patch("app.services.cliente.find_cliente_by_documento",
               return_value=existente) as mock_find:
        upsert_cliente(mock_db, "Contato", "12.345.678/0001-90", None)

    mock_find.assert_called_once()
    mock_db.add.assert_not_called()  # atualizou, não criou outro


# ── GET /clientes ─────────────────────────────────────────────────────────────

def test_list_clientes_retorna_items(make_test_client, mock_db):
    chain = mock_db.query.return_value
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.limit.return_value = chain
    chain.all.return_value = [_make_cliente("A"), _make_cliente("B")]

    client = make_test_client(router)
    r = client.get("/clientes")

    assert r.status_code == 200
    assert len(r.json()["items"]) == 2
