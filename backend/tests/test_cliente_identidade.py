"""
Regra de identidade de cliente: mesmo NOME e mesmo DOCUMENTO são o mesmo
cliente; sem documento, são sempre clientes diferentes.

A decisão fica isolada em `selecionar_cliente`, que é pura — recebe os
candidatos prontos. Por isso dá para cobrir todos os casos aqui sem banco.
"""
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services.cliente_identidade import (
    normalizar_documento,
    normalizar_nome,
    obter_ou_criar_cliente,
    selecionar_cliente,
)


def _cli(nome, cnpj=None):
    return SimpleNamespace(nome=nome, cnpj=cnpj, deleted_at=None)


# ── Normalização ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize("entrada,esperado", [
    ("11.111.111/1111-11", "11111111111111"),
    ("11111111111111", "11111111111111"),
    ("123.456.789-00", "12345678900"),
    ("  11.111.111/1111-11  ", "11111111111111"),
    (None, ""),
    ("", ""),
    ("   ", ""),
])
def test_normalizar_documento(entrada, esperado):
    assert normalizar_documento(entrada) == esperado


@pytest.mark.parametrize("entrada,esperado", [
    ("Empresa Alpha", "empresa alpha"),
    ("  Empresa Alpha  ", "empresa alpha"),
    ("EMPRESA ALPHA", "empresa alpha"),
    (None, ""),
])
def test_normalizar_nome(entrada, esperado):
    assert normalizar_nome(entrada) == esperado


# ── A regra ──────────────────────────────────────────────────────────────────

def test_mesmo_nome_e_mesmo_documento_e_o_mesmo_cliente():
    alvo = _cli("Empresa Alpha Ltda", "11.111.111/1111-11")
    assert selecionar_cliente([alvo], "Empresa Alpha Ltda", "11.111.111/1111-11") is alvo


def test_mesmo_documento_com_nome_diferente_e_outro_cliente():
    """O ponto central da regra. Antes, o CNPJ decidia sozinho e o nome
    digitado era descartado."""
    outro = _cli("Empresa Alpha", "11.111.111/1111-11")
    assert selecionar_cliente([outro], "Empresa Alpha Ltda", "11.111.111/1111-11") is None


def test_sem_documento_sempre_e_cliente_novo():
    """Mesmo com nome idêntico: sem documento não há como afirmar que é a mesma
    pessoa, e a regra manda tratar como cliente diferente."""
    homonimo = _cli("Joao", None)
    assert selecionar_cliente([homonimo], "Joao", None) is None
    assert selecionar_cliente([homonimo], "Joao", "") is None
    assert selecionar_cliente([homonimo], "Joao", "   ") is None


def test_documento_com_pontuacao_diferente_ainda_e_o_mesmo():
    """O campo é texto livre: o mesmo documento chega escrito de formas
    diferentes. Comparar as strings cruas criaria duplicata."""
    alvo = _cli("Empresa Alpha", "11.111.111/1111-11")
    assert selecionar_cliente([alvo], "Empresa Alpha", "11111111111111") is alvo


def test_nome_difere_so_em_caixa_ou_espaco_e_o_mesmo():
    alvo = _cli("  Empresa Alpha  ", "11111111111111")
    assert selecionar_cliente([alvo], "EMPRESA ALPHA", "11111111111111") is alvo


def test_nome_igual_documento_diferente_e_outro_cliente():
    outro = _cli("Empresa Alpha", "22222222222222")
    assert selecionar_cliente([outro], "Empresa Alpha", "11111111111111") is None


def test_escolhe_o_candidato_certo_no_meio_de_varios():
    a = _cli("Empresa Alpha", "22222222222222")
    b = _cli("Empresa Alpha", "11111111111111")
    c = _cli("Empresa Beta", "11111111111111")
    assert selecionar_cliente([a, b, c], "Empresa Alpha", "11.111.111/1111-11") is b


def test_candidato_sem_documento_nunca_casa():
    sem_doc = _cli("Empresa Alpha", None)
    assert selecionar_cliente([sem_doc], "Empresa Alpha", "11111111111111") is None


# ── Integração com a sessão ──────────────────────────────────────────────────

def test_sem_documento_nao_consulta_o_banco():
    """Sem documento a resposta é sempre 'cliente novo'. Ir ao banco seria
    trabalho jogado fora em todo pedido sem CPF/CNPJ."""
    db = MagicMock()
    obter_ou_criar_cliente(db, "Joao", None)
    db.query.assert_not_called()
    db.add.assert_called_once()
    db.flush.assert_called_once()


def test_cria_quando_nao_ha_correspondente():
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [
        _cli("Empresa Alpha", "99999999999999")
    ]
    criado = obter_ou_criar_cliente(db, "Empresa Alpha", "11111111111111")
    db.add.assert_called_once()
    assert criado.nome == "Empresa Alpha"
    assert criado.cnpj == "11111111111111"


def test_reaproveita_sem_inserir_quando_ja_existe():
    db = MagicMock()
    alvo = _cli("Empresa Alpha", "11.111.111/1111-11")
    db.query.return_value.filter.return_value.all.return_value = [alvo]
    assert obter_ou_criar_cliente(db, "Empresa Alpha", "11111111111111") is alvo
    db.add.assert_not_called()
