"""Idempotencia e ordem da numeracao na criacao de cotacao.

A cotacao tem contador proprio (cotacao_numero_seq) e sofria dos mesmos tres
problemas do pedido: numero saindo antes do INSERT, loja/vendedor conferidos
tarde demais, e nenhuma forma de reconhecer uma tentativa repetida quando a
resposta se perde.

Medido no banco de producao: 47 cotacoes, contador em 64 — 17 numeros (10 a 26)
entregues e nunca usados.

Aqui a ordem importa ainda mais que no pedido, por causa da uq_cotacao
(loja + vendedor + data + nº de requisicao): tentativa duplicada e recusada pelo
BANCO, depois do nextval. Com o numero saindo antes, cada recusa custava um
numero — e recusa por duplicata e coisa que acontece no uso normal.
"""
import re
import uuid
from pathlib import Path
from unittest.mock import patch

import sqlalchemy as sa

from app.models.cotacao import Cotacao
from app.api.routes.cotacoes import router as cotacoes_router

BACKEND = Path(__file__).resolve().parents[1]
SERVICO = BACKEND / "app" / "services" / "cotacao.py"
MIGRATION = BACKEND / "alembic" / "versions" / "c8d9e0f1a2b3_add_idempotency_key_to_cotacoes.py"


def _corpo_do_create() -> str:
    fonte = SERVICO.read_text(encoding="utf-8")
    return fonte.split("def create(")[1].split("    @staticmethod")[0]


# ── Model ─────────────────────────────────────────────────────────────────────

def test_coluna_existe_e_e_opcional():
    coluna = Cotacao.__table__.columns["idempotency_key"]
    assert coluna.nullable is True
    assert isinstance(coluna.type, sa.String)
    assert coluna.type.length == 64


def test_indice_unico_por_usuario():
    indices = {i.name: i for i in Cotacao.__table__.indexes}
    idx = indices.get("ux_cotacoes_idempotency")
    assert idx is not None, f"indice ausente; existem: {sorted(indices)}"
    assert idx.unique is True
    assert [c.name for c in idx.columns] == ["created_by", "idempotency_key"]


def test_uq_cotacao_continua_existindo():
    """A restricao que recusa cotacao duplicada e o motivo de a ordem importar
    tanto aqui. Se ela sumir, o comentario do service vira mentira."""
    nomes = {c.name for c in Cotacao.__table__.constraints}
    assert "uq_cotacao" in nomes


# ── Ordem: o número sai depois do INSERT ──────────────────────────────────────

def test_numero_sai_depois_do_insert():
    corpo = _corpo_do_create()
    pos_flush = corpo.find("db.flush()")
    pos_nextval = corpo.find("_generate_numero(")
    assert pos_flush != -1 and pos_nextval != -1
    assert pos_flush < pos_nextval, (
        "_generate_numero precisa vir DEPOIS do primeiro db.flush(); antes dele, "
        "toda cotacao recusada pelo banco queima um numero"
    )


def test_cotacao_e_inserida_sem_numero():
    """numero e nullable, entao aqui nem precisa de rascunho como no pedido: a
    linha entra sem numero e recebe o definitivo no mesmo commit."""
    construcao = _corpo_do_create().split("db.add(cotacao)")[0]
    assert "numero=None" in construcao
    assert "_generate_numero(" not in construcao


def test_valida_loja_e_vendedor_antes_de_numerar():
    corpo = _corpo_do_create()
    pos_validacao = corpo.find("validar_loja_e_vendedor(")
    pos_nextval = corpo.find("_generate_numero(")
    assert pos_validacao != -1, "a validacao de loja/vendedor nao esta no create"
    assert pos_validacao < pos_nextval


def test_busca_pela_chave_vem_antes_de_tudo():
    corpo = _corpo_do_create()
    assert corpo.find("_cotacao_da_tentativa(") < corpo.find("validar_loja_e_vendedor(")


def test_conflito_de_indice_devolve_a_cotacao_existente():
    corpo = _corpo_do_create()
    assert "except IntegrityError" in corpo
    assert "db.rollback()" in corpo


def test_integrityerror_alheio_nao_e_engolido():
    """A uq_cotacao tambem chega como IntegrityError. Sem achar cotacao com a
    chave, tem que subir — silenciar viraria 201 mentiroso."""
    trecho = _corpo_do_create().split("except IntegrityError")[1]
    assert re.search(r"if concorrente is None:\s*(#.*\n\s*)*raise", trecho)


def test_busca_nao_filtra_soft_delete():
    fonte = SERVICO.read_text(encoding="utf-8")
    corpo = fonte.split("def _cotacao_da_tentativa(")[1].split("\ndef ")[0]
    assert "Cotacao.deleted_at" not in corpo


# ── Rota ──────────────────────────────────────────────────────────────────────

# Reaproveita o fake e o payload de test_routes_cotacoes: manter uma segunda
# copia aqui seria a mesma duplicacao que deixou o migrate_item_rma_status para
# tras — e o CotacaoResponse tem campo demais para copiar a mao sem errar.
from tests.test_routes_cotacoes import _fake_cotacao, _COTACAO_PAYLOAD


def _fake(replay: bool):
    cotacao = _fake_cotacao()
    cotacao.idempotent_replay = replay
    return cotacao


class TestHeaderIdempotencia:

    def test_repassa_a_chave_para_o_service(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.create",
                   return_value=_fake(False)) as mock_create:
            client.post("/quotes", json=_COTACAO_PAYLOAD, headers={"Idempotency-Key": "abc-123"})
        assert mock_create.call_args.kwargs["idempotency_key"] == "abc-123"

    def test_sem_header_a_chave_vai_nula(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.create",
                   return_value=_fake(False)) as mock_create:
            client.post("/quotes", json=_COTACAO_PAYLOAD)
        assert mock_create.call_args.kwargs["idempotency_key"] is None

    def test_header_em_branco_equivale_a_ausente(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.create",
                   return_value=_fake(False)) as mock_create:
            client.post("/quotes", json=_COTACAO_PAYLOAD, headers={"Idempotency-Key": "   "})
        assert mock_create.call_args.kwargs["idempotency_key"] is None

    def test_chave_longa_demais_e_recusada(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.create",
                   return_value=_fake(False)) as mock_create:
            resp = client.post("/quotes", json=_COTACAO_PAYLOAD,
                               headers={"Idempotency-Key": "x" * 65})
        assert resp.status_code == 422
        mock_create.assert_not_called()

    def test_reenvio_marca_o_header_de_resposta(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.create",
                   return_value=_fake(True)):
            resp = client.post("/quotes", json=_COTACAO_PAYLOAD,
                               headers={"Idempotency-Key": str(uuid.uuid4())})
        assert resp.status_code == 201, "reenvio continua 201 — a tela nao ramifica"
        assert resp.headers.get("Idempotent-Replay") == "true"

    def test_criacao_normal_nao_marca_reenvio(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.create",
                   return_value=_fake(False)):
            resp = client.post("/quotes", json=_COTACAO_PAYLOAD,
                               headers={"Idempotency-Key": str(uuid.uuid4())})
        assert "Idempotent-Replay" not in resp.headers


# ── Migration ─────────────────────────────────────────────────────────────────

def _sql_do_upgrade() -> str:
    import ast
    arvore = ast.parse(MIGRATION.read_text(encoding="utf-8"))
    upgrade = next(n for n in arvore.body
                   if isinstance(n, ast.FunctionDef) and n.name == "upgrade")
    trechos = [
        no.args[0].value
        for no in ast.walk(upgrade)
        if isinstance(no, ast.Call)
        and getattr(no.func, "attr", None) == "execute"
        and no.args and isinstance(no.args[0], ast.Constant)
        and isinstance(no.args[0].value, str)
    ]
    assert trechos, "upgrade() nao executa SQL nenhum"
    return " ".join(trechos)


def test_migration_encadeia_na_do_pedido():
    assert "down_revision: Union[str, None] = 'b7c8d9e0f1a2'" in MIGRATION.read_text(
        encoding="utf-8"
    )


def test_migration_e_idempotente():
    sql = _sql_do_upgrade()
    assert "ADD COLUMN IF NOT EXISTS" in sql
    assert "CREATE UNIQUE INDEX IF NOT EXISTS" in sql


def test_migration_cria_o_mesmo_indice_do_model():
    sql = _sql_do_upgrade()
    assert "ux_cotacoes_idempotency" in sql
    assert re.search(r"created_by\s*,\s*idempotency_key", sql)


def test_indice_sem_concurrently():
    assert "CONCURRENTLY" not in _sql_do_upgrade().upper()
