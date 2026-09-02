"""Erro de banco vira frase legivel, e nunca dump do driver.

As rotas faziam `except Exception as exc: HTTPException(400, str(exc))`. Para
erro levantado pelo nosso codigo isso serve — a mensagem foi escrita por nos.
Para erro vindo do banco, o vendedor lia na tela o texto do psycopg2 inteiro,
com nome de constraint e chave. Estes testes travam a traducao e, principalmente,
travam o que NAO pode aparecer na tela.
"""
import logging
import re
from pathlib import Path

import pytest
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError, DataError, OperationalError

from app.utils.errors import (
    NotFoundException, BusinessLogicException,
    mensagem_de_erro, erro_http,
)

ROTAS = Path(__file__).resolve().parents[1] / "app" / "api" / "routes"

# Vazamentos: o que o dump do psycopg2 e o do SQLAlchemy carregam.
VAZAMENTOS = ["psycopg2", "DETAIL:", "INSERT INTO", "UPDATE ", "SELECT ",
              "Traceback", "_fkey", "_pkey", "sqlalchemy", "[SQL:"]


class _Diag:
    def __init__(self, **kw):
        self.column_name = kw.get("column_name")
        self.message_detail = kw.get("message_detail")
        self.constraint_name = kw.get("constraint_name")
        self.table_name = kw.get("table_name")


def _pg(nome_da_classe: str, texto: str, **diag) -> Exception:
    """Erro do driver, imitado pelo nome da classe.

    O modulo compara por nome justamente para nao precisar de psycopg2 — que o
    conftest evita, apontando tudo para SQLite. Imitar aqui e coerente com isso;
    o casamento com os erros reais foi verificado contra Postgres de verdade.
    """
    classe = type(nome_da_classe, (Exception,), {})
    erro = classe(texto)
    erro.diag = _Diag(**diag)
    return erro


def _wrap(orig, erro=IntegrityError):
    """Como a excecao chega na rota: embrulhada pelo SQLAlchemy, com o SQL e os
    parametros ligados junto."""
    return erro(
        'INSERT INTO pedidos (numero_os, created_by) VALUES (%(n)s, %(u)s)',
        {"n": "OS-001", "u": "senha-secreta-hash"},
        orig,
    )


FK_COTACAO = _wrap(_pg(
    "ForeignKeyViolation",
    'insert or update on table "pedidos" violates foreign key constraint "pedidos_id_cotacao_fkey"',
    message_detail='Key (id_cotacao)=(3f2a) is not present in table "cotacoes".',
    constraint_name="pedidos_id_cotacao_fkey", table_name="pedidos",
))
FK_VINCULADO = _wrap(_pg(
    "ForeignKeyViolation",
    'update or delete on table "lojas" violates foreign key constraint',
    message_detail='Key (id)=(1a) is still referenced from table "pedidos".',
    constraint_name="pedidos_id_loja_fkey", table_name="lojas",
))
UNICO = _wrap(_pg(
    "UniqueViolation", 'duplicate key value violates unique constraint "ux_pedidos_idempotency"',
    message_detail="Key (created_by, idempotency_key)=(1a, abc) already exists.",
    constraint_name="ux_pedidos_idempotency", table_name="pedidos",
))
NOT_NULL = _wrap(_pg(
    "NotNullViolation", 'null value in column "numero_os" violates not-null constraint',
    column_name="numero_os", table_name="pedidos",
))
CHECK = _wrap(_pg(
    "CheckViolation", 'new row violates check constraint "pedidos_status_check"',
    constraint_name="pedidos_status_check", table_name="pedidos",
))
LONGO = _wrap(_pg(
    "StringDataRightTruncation", "value too long for type character varying(50)",
    column_name="numero_oc", table_name="pedidos",
), DataError)
FORA_DO_AR = _wrap(_pg(
    "OperationalError", "server closed the connection unexpectedly",
), OperationalError)

TODOS = [FK_COTACAO, FK_VINCULADO, UNICO, NOT_NULL, CHECK, LONGO, FORA_DO_AR,
         RuntimeError("boom"), ValueError("algo estranho")]


# ── O que o vendedor vê ───────────────────────────────────────────────────────

def test_fk_diz_qual_vinculo_sumiu():
    msg = mensagem_de_erro(FK_COTACAO, "criar o pedido")
    assert "Cotação de origem" in msg
    assert "recarregue a página" in msg.lower()


def test_fk_ao_contrario_fala_em_excluir():
    """Mesmo erro do banco, sentido oposto: alguem aponta para o que eu quero
    apagar. Dizer 'registro não encontrado' aqui seria mentira."""
    msg = mensagem_de_erro(FK_VINCULADO, "excluir a empresa")
    assert "não é possível excluir" in msg.lower()
    assert "vinculados" in msg.lower()


def test_unico_so_de_colunas_internas_nao_cita_coluna():
    """O indice de idempotencia e (created_by, idempotency_key). Nomear as duas
    daria "Já existe outro registro com o mesmo valor em Usuário que criou,
    identificador da tentativa" — verdade, e inutil para quem le."""
    msg = mensagem_de_erro(UNICO, "criar o pedido")
    assert msg == "Este registro já foi salvo."


def test_unico_de_coluna_visivel_diz_qual_e():
    duplicado = _wrap(_pg(
        "UniqueViolation", 'duplicate key value violates unique constraint "clientes_email_key"',
        message_detail="Key (email)=(a@b.com) already exists.",
        constraint_name="clientes_email_key", table_name="clientes",
    ))
    assert mensagem_de_erro(duplicado, "salvar") == \
        "Já existe outro registro com o mesmo valor em E-mail."


def test_not_null_usa_o_rotulo_da_tela():
    assert mensagem_de_erro(NOT_NULL, "salvar") == "Nº da OS: preenchimento obrigatório."


def test_check_deduz_o_campo_pelo_nome_do_constraint():
    """CheckViolation nao traz column_name nem DETAIL. Sobra ler
    'pedidos_status_check' e chegar em Status."""
    assert mensagem_de_erro(CHECK, "salvar") == "Status: valor não permitido."


def test_texto_longo_demais():
    assert mensagem_de_erro(LONGO, "salvar") == "OC/AF/PED: texto longo demais."


def test_sem_coluna_a_frase_ainda_e_portugues():
    """Postgres frequentemente nao informa a coluna nesses erros — nem DETAIL
    nem column_name. "Um dos campos: texto longo demais" nao e frase."""
    sem_coluna = _wrap(_pg(
        "StringDataRightTruncation", "value too long for type character varying(50)",
    ), DataError)
    assert mensagem_de_erro(sem_coluna, "salvar") == "Um dos campos tem texto longo demais."


def test_banco_fora_do_ar_pede_para_tentar_de_novo():
    msg = mensagem_de_erro(FORA_DO_AR, "salvar")
    assert "tente de novo" in msg.lower()


@pytest.mark.parametrize("exc", TODOS)
def test_nenhuma_mensagem_vaza_detalhe_tecnico(exc):
    msg = mensagem_de_erro(exc, "salvar o pedido")
    for pedaco in VAZAMENTOS:
        assert pedaco.lower() not in msg.lower(), f"vazou {pedaco!r} em: {msg}"


# ── Erro que não sabemos explicar ─────────────────────────────────────────────

CODIGO = re.compile(r"\b([0-9A-F]{6})\b")


def test_erro_desconhecido_da_frase_generica_com_codigo():
    msg = mensagem_de_erro(RuntimeError("qualquer coisa"), "criar o pedido")
    assert "não foi possível criar o pedido" in msg.lower()
    assert CODIGO.search(msg), msg


def test_o_codigo_da_tela_e_o_mesmo_do_log(caplog):
    """O codigo so serve para casar a tela com o log. Se forem diferentes, ele
    nao serve para nada."""
    caplog.set_level(logging.DEBUG, logger="app.erros")
    msg = mensagem_de_erro(RuntimeError("qualquer coisa"), "criar o pedido")
    codigo = CODIGO.search(msg).group(1)
    assert any(codigo in r.getMessage() for r in caplog.records), caplog.text


def test_cada_erro_tem_codigo_proprio():
    a = CODIGO.search(mensagem_de_erro(RuntimeError("x"), "salvar")).group(1)
    b = CODIGO.search(mensagem_de_erro(RuntimeError("x"), "salvar")).group(1)
    assert a != b


def test_erro_desconhecido_vai_para_o_log_com_traceback(caplog):
    """Trocar mensagem tecnica por mensagem legivel nao pode custar a
    capacidade de investigar depois."""
    caplog.set_level(logging.DEBUG, logger="app.erros")
    mensagem_de_erro(RuntimeError("estourou aqui"), "salvar")
    registro = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert registro and registro[0].exc_info is not None


def test_erro_conhecido_tambem_e_registrado(caplog):
    caplog.set_level(logging.DEBUG, logger="app.erros")
    mensagem_de_erro(FK_COTACAO, "criar o pedido")
    assert caplog.records, "erro de banco tem que aparecer no log mesmo quando traduzido"


def test_log_nao_carrega_os_parametros_ligados(caplog):
    """str() da excecao do SQLAlchemy traz o SQL e os valores ligados junto —
    inclui hash de senha e dado de cliente. O log usa a mensagem do driver."""
    caplog.set_level(logging.DEBUG, logger="app.erros")
    mensagem_de_erro(NOT_NULL, "salvar")
    assert "senha-secreta-hash" not in caplog.text


# ── Erros nossos continuam intactos ───────────────────────────────────────────

def test_excecao_nossa_mantem_a_propria_mensagem():
    """NotFoundException e BusinessLogicException carregam texto escrito para
    ser lido. Substituir por frase generica seria piorar."""
    assert mensagem_de_erro(NotFoundException("Loja X nao encontrada"), "criar") == "Loja X nao encontrada"
    assert mensagem_de_erro(BusinessLogicException("Pedido possui RMA"), "excluir") == "Pedido possui RMA"


def test_excecao_nossa_nao_polui_o_log(caplog):
    caplog.set_level(logging.DEBUG, logger="app.erros")
    mensagem_de_erro(NotFoundException("Loja X nao encontrada"), "criar")
    assert not caplog.records


# ── erro_http ─────────────────────────────────────────────────────────────────

def test_http_exception_passa_intacta():
    """Se o codigo la dentro ja decidiu o status, remarcar como 400 perde
    informacao — o 422 da chave de idempotencia longa demais, por exemplo."""
    original = HTTPException(status_code=422, detail="Idempotency-Key longa demais")
    devolvida = erro_http(original, "criar o pedido")
    assert devolvida is original


def test_erro_http_mantem_o_status_da_rota():
    resposta = erro_http(FK_COTACAO, "criar o pedido")
    assert resposta.status_code == status.HTTP_400_BAD_REQUEST
    assert "Cotação de origem" in resposta.detail


# ── Regressão: o padrão antigo não pode voltar ────────────────────────────────

def test_nenhuma_rota_devolve_str_exc_em_except_generico():
    """`except ValueError` com str(exc) continua valendo: essas mensagens sao
    nossas. O que nao pode e `except Exception`, que pega erro de banco."""
    problemas = []
    for arquivo in sorted(ROTAS.glob("*.py")):
        linhas = arquivo.read_text(encoding="utf-8").splitlines()
        for i, linha in enumerate(linhas):
            if "except Exception" not in linha:
                continue
            trecho = " ".join(linhas[i + 1:i + 4])
            if "str(exc)" in trecho or "str(e)" in trecho:
                problemas.append(f"{arquivo.name}:{i + 1}")
    assert not problemas, (
        "estas rotas voltaram a jogar o erro cru do banco na tela: "
        + ", ".join(problemas)
    )
