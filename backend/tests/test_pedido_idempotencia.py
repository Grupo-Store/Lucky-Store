"""Idempotencia na criacao de pedido.

Contexto: numero de OS vem de nextval, que nao volta no rollback. Duas correcoes
ja tinham entrado — validar loja/vendedor antes do nextval, e parar de reenviar
POST automaticamente. Sobrava o caso em que a criacao da certo e so a RESPOSTA
se perde: a tela nao distingue isso de falha, e a segunda tentativa criava um
pedido gemeo com outro numero.

A chave (header Idempotency-Key) fecha esse caso. Estes testes travam as tres
coisas de que ela depende: a coluna existir, a busca acontecer ANTES do nextval,
e o indice unico segurar o empate de duas requisicoes simultaneas.
"""
import re
import uuid
from pathlib import Path
from unittest.mock import patch

import sqlalchemy as sa

from app.models.pedido import Pedido
from app.services.pedido import _numero_provisorio
from app.api.routes.pedidos import router as pedidos_router

from tests.test_routes_pedidos import _fake_pedido, _PEDIDO_PAYLOAD

BACKEND = Path(__file__).resolve().parents[1]
SERVICO = BACKEND / "app" / "services" / "pedido.py"
CONVERSAO = BACKEND / "app" / "services" / "conversao_cotacao.py"
REFERENCIAS = BACKEND / "app" / "services" / "referencias.py"
MIGRATION = BACKEND / "alembic" / "versions" / "b7c8d9e0f1a2_add_idempotency_key_to_pedidos.py"


# ── Model ─────────────────────────────────────────────────────────────────────

def test_coluna_existe_e_e_opcional():
    """Opcional de proposito: pedido criado por outro caminho (conversao de
    cotacao, seed, import) continua entrando sem chave."""
    coluna = Pedido.__table__.columns["idempotency_key"]
    assert coluna.nullable is True
    assert isinstance(coluna.type, sa.String)
    assert coluna.type.length == 64


def test_indice_unico_por_usuario():
    """Por (created_by, chave), nao so pela chave: assim a chave de um vendedor
    nunca devolve o pedido de outro. E precisa ser UNIQUE — e a exclusividade,
    nao a busca, que segura duas requisicoes iguais em voo ao mesmo tempo."""
    indices = {i.name: i for i in Pedido.__table__.indexes}
    idx = indices.get("ux_pedidos_idempotency")
    assert idx is not None, f"indice ausente; existem: {sorted(indices)}"
    assert idx.unique is True
    assert [c.name for c in idx.columns] == ["created_by", "idempotency_key"]


# ── Service ───────────────────────────────────────────────────────────────────

def _corpo_do_create() -> str:
    fonte = SERVICO.read_text(encoding="utf-8")
    return fonte.split("def create(")[1].split("    @staticmethod")[0]


def test_busca_pela_chave_vem_antes_do_nextval():
    """O ponto inteiro da correcao. Consultar a chave depois de gerar o numero
    nao adiantaria nada: o numero ja teria sido gasto."""
    corpo = _corpo_do_create()
    pos_busca = corpo.find("_pedido_da_tentativa(")
    pos_nextval = corpo.find("_generate_numero_os(")
    assert pos_busca != -1 and pos_nextval != -1
    assert pos_busca < pos_nextval, (
        "a busca pela chave precisa acontecer antes de _generate_numero_os; "
        "depois dele o numero de OS ja foi consumido"
    )


def test_referencia_invalida_nao_mostra_uuid_na_tela():
    """A mensagem vai direto para a tela do vendedor. Um UUID ali nao ajuda
    ninguem — ele vai para o log, onde e o que interessa para investigar."""
    corpo = REFERENCIAS.read_text(encoding="utf-8")
    mensagens = re.findall(r"NotFoundException\(\s*(.+?)\s*\)", corpo, re.S)
    assert mensagens, "nenhuma mensagem encontrada"
    for m in mensagens:
        assert "id_loja" not in m and "id_vendedor" not in m, f"UUID na tela: {m}"
    assert "logger.warning" in corpo, "o UUID precisa ir para o log"


def test_validacao_e_compartilhada_entre_pedido_e_cotacao():
    """Pedido e cotacao precisam da mesma checagem pelo mesmo motivo. Duplicar
    seria repetir o erro do migrate_item_rma_status, onde uma copia da lista de
    status ficou para tras e so foi descoberta meses depois."""
    for servico in (SERVICO, BACKEND / "app" / "services" / "cotacao.py"):
        fonte = servico.read_text(encoding="utf-8")
        assert "from app.services.referencias import validar_loja_e_vendedor" in fonte, (
            f"{servico.name} nao usa a validacao compartilhada"
        )


# ── Ordem: o numero da OS sai depois do INSERT ────────────────────────────────

def test_numero_definitivo_sai_depois_do_insert():
    """O ponto que fecha a corrida.

    O INSERT e onde o banco decide quem ganhou: o perdedor toma IntegrityError
    ali. Pedindo o numero antes dele, o perdedor gastava um numero sem criar
    pedido nenhum — medido, 4 requisicoes simultaneas com a mesma chave criavam
    1 pedido e queimavam 4 numeros. Pedindo depois, quem perde nem chega la.
    """
    corpo = _corpo_do_create()
    pos_flush = corpo.find("db.flush()")
    pos_nextval = corpo.find("_generate_numero_os(")
    assert pos_flush != -1 and pos_nextval != -1
    assert pos_flush < pos_nextval, (
        "_generate_numero_os precisa vir DEPOIS do primeiro db.flush(); antes "
        "dele, toda insercao recusada pelo banco queima um numero de OS"
    )


def test_pedido_e_inserido_com_numero_provisorio():
    """Corolario do teste acima: se a linha nao nasce com um numero de rascunho,
    e porque o numero de verdade voltou para antes do INSERT."""
    corpo = _corpo_do_create()
    construcao = corpo.split("db.add(pedido)")[0]
    assert "_numero_provisorio(" in construcao
    assert "_generate_numero_os(" not in construcao


def test_auditoria_registra_o_numero_definitivo():
    """O audit_log guarda numero_os. Registrado antes da troca, ele gravaria o
    rascunho — e a trilha apontaria para uma OS que nao existe."""
    corpo = _corpo_do_create()
    assert corpo.find("_generate_numero_os(") < corpo.find("_audit(")


def test_numero_provisorio_cabe_na_coluna():
    provisorio = _numero_provisorio(uuid.uuid4())
    limite = Pedido.__table__.columns["numero_os"].type.length
    assert len(provisorio) <= limite, f"{len(provisorio)} > {limite}"


def test_numero_provisorio_nao_se_parece_com_uma_os():
    """Se um rascunho vazasse para o banco, casar com o formato OS-### o faria
    entrar no MAX da migration de reparo da sequence e pular a numeracao."""
    provisorio = _numero_provisorio(uuid.uuid4())
    assert not re.match(r"^OS-[0-9]+$", provisorio)


# ── A conversão de cotação segue a mesma ordem ────────────────────────────────
#
# É o outro caminho que cria pedido e chama nextval. Ele não precisa de chave de
# idempotência: a cotação de origem já é a chave, e o service segura a corrida
# com with_for_update() na cotação mais a checagem de pedido existente. O que
# faltava era a ordem — o número saía antes do INSERT.

def _corpo_da_conversao() -> str:
    fonte = CONVERSAO.read_text(encoding="utf-8")
    return fonte.split("def convert_to_pedido(")[1]


def test_conversao_tira_o_numero_depois_do_insert():
    corpo = _corpo_da_conversao()
    pos_flush = corpo.find("db.flush()")
    pos_nextval = corpo.find("_generate_numero_os(")
    assert pos_flush != -1 and pos_nextval != -1
    assert pos_flush < pos_nextval, (
        "na conversão o número da OS também precisa sair depois do INSERT"
    )


def test_conversao_insere_com_numero_provisorio():
    construcao = _corpo_da_conversao().split("db.add(pedido)")[0]
    assert "_numero_provisorio(" in construcao
    assert "_generate_numero_os(" not in construcao


def test_conversao_ja_protegia_contra_duplicata():
    """Não mexi nisto — registro para que não se perca numa refatoração.

    `with_for_update()` serializa duas conversões simultâneas da mesma cotação,
    e a busca por pedido existente barra a segunda. Juntas, valem mais que um
    header de idempotência: a chave aqui é a própria cotação."""
    corpo = _corpo_da_conversao()
    assert "with_for_update()" in corpo
    assert "existing_pedido" in corpo


def test_rota_de_conversao_trata_erro_de_banco():
    """Ela não tinha `except Exception` e ficou de fora da tradução — erro de
    banco virava 500 cru."""
    rota = (BACKEND / "app" / "api" / "routes" / "conversao_cotacao.py").read_text(encoding="utf-8")
    assert "except Exception" in rota and "erro_http(" in rota


def test_conflito_de_indice_devolve_o_pedido_existente():
    corpo = _corpo_do_create()
    assert "except IntegrityError" in corpo
    assert "db.rollback()" in corpo
    assert "concorrente" in corpo


def test_integrityerror_alheio_nao_e_engolido():
    """FK ou NOT NULL violado tambem chega como IntegrityError. Sem achar
    pedido com a chave, tem que subir — silenciar viraria 201 mentiroso."""
    corpo = _corpo_do_create()
    trecho = corpo.split("except IntegrityError")[1]
    assert re.search(r"if concorrente is None:\s*(#.*\n\s*)*raise", trecho), (
        "faltou o re-raise quando nenhum pedido corresponde a chave"
    )


def test_busca_nao_filtra_soft_delete():
    """Pedido apagado ja gastou o numero da OS. Filtrar deleted_at aqui faria a
    tentativa repetida criar exatamente a duplicata que a chave impede."""
    fonte = SERVICO.read_text(encoding="utf-8")
    corpo = fonte.split("def _pedido_da_tentativa(")[1].split("\ndef ")[0]
    assert "Pedido.deleted_at" not in corpo


# ── Rota ──────────────────────────────────────────────────────────────────────

class TestHeaderIdempotencia:

    def test_repassa_a_chave_para_o_service(self, make_test_client, mock_db):
        client = make_test_client(pedidos_router)
        with patch("app.api.routes.pedidos.PedidoService.create",
                   return_value=_fake_pedido()) as mock_create:
            client.post("/pedidos", json=_PEDIDO_PAYLOAD,
                        headers={"Idempotency-Key": "abc-123"})
        assert mock_create.call_args.kwargs["idempotency_key"] == "abc-123"

    def test_sem_header_a_chave_vai_nula(self, make_test_client, mock_db):
        client = make_test_client(pedidos_router)
        with patch("app.api.routes.pedidos.PedidoService.create",
                   return_value=_fake_pedido()) as mock_create:
            client.post("/pedidos", json=_PEDIDO_PAYLOAD)
        assert mock_create.call_args.kwargs["idempotency_key"] is None

    def test_header_em_branco_equivale_a_ausente(self, make_test_client, mock_db):
        """String vazia como chave casaria com qualquer outra vazia e devolveria
        pedido alheio ao proprio usuario."""
        client = make_test_client(pedidos_router)
        with patch("app.api.routes.pedidos.PedidoService.create",
                   return_value=_fake_pedido()) as mock_create:
            client.post("/pedidos", json=_PEDIDO_PAYLOAD,
                        headers={"Idempotency-Key": "   "})
        assert mock_create.call_args.kwargs["idempotency_key"] is None

    def test_chave_longa_demais_e_recusada(self, make_test_client, mock_db):
        """Deixar passar faria o banco truncar em 64: a chave gravada nao bateria
        com a reenviada, e a tentativa seguinte criaria pedido duplicado."""
        client = make_test_client(pedidos_router)
        with patch("app.api.routes.pedidos.PedidoService.create",
                   return_value=_fake_pedido()) as mock_create:
            resp = client.post("/pedidos", json=_PEDIDO_PAYLOAD,
                               headers={"Idempotency-Key": "x" * 65})
        assert resp.status_code == 422
        mock_create.assert_not_called()

    def test_reenvio_marca_o_header_de_resposta(self, make_test_client, mock_db):
        client = make_test_client(pedidos_router)
        pedido = _fake_pedido()
        pedido.idempotent_replay = True
        with patch("app.api.routes.pedidos.PedidoService.create", return_value=pedido):
            resp = client.post("/pedidos", json=_PEDIDO_PAYLOAD,
                               headers={"Idempotency-Key": str(uuid.uuid4())})
        assert resp.status_code == 201, "reenvio continua 201 — a tela nao precisa ramificar"
        assert resp.headers.get("Idempotent-Replay") == "true"

    def test_criacao_normal_nao_marca_reenvio(self, make_test_client, mock_db):
        client = make_test_client(pedidos_router)
        pedido = _fake_pedido()
        pedido.idempotent_replay = False
        with patch("app.api.routes.pedidos.PedidoService.create", return_value=pedido):
            resp = client.post("/pedidos", json=_PEDIDO_PAYLOAD,
                               headers={"Idempotency-Key": str(uuid.uuid4())})
        assert "Idempotent-Replay" not in resp.headers


# ── Migration ─────────────────────────────────────────────────────────────────

def _sql_do_upgrade() -> str:
    """So o SQL que o upgrade() executa — comentario nao conta.

    Le por AST em vez de regex porque as chamadas usam concatenacao implicita de
    literais ("..." "..."), que regex de uma string so nao pega. E porque um
    teste que aceitasse comentario como se fosse SQL passaria com a migration
    vazia, desde que o texto certo estivesse escrito ao lado."""
    import ast
    arvore = ast.parse(MIGRATION.read_text(encoding="utf-8"))
    upgrade = next(
        n for n in arvore.body
        if isinstance(n, ast.FunctionDef) and n.name == "upgrade"
    )
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


def test_migration_encadeia_no_head_anterior():
    assert "down_revision: Union[str, None] = 'a5b6c7d8e9f0'" in MIGRATION.read_text(
        encoding="utf-8"
    )


def test_migration_e_idempotente():
    sql = _sql_do_upgrade()
    assert "ADD COLUMN IF NOT EXISTS" in sql
    assert "CREATE UNIQUE INDEX IF NOT EXISTS" in sql


def test_migration_cria_o_mesmo_indice_do_model():
    """Se os nomes divergirem, banco migrado e banco criado por create_all ficam
    com indices diferentes — e o create_all tentaria criar um que ja existe."""
    sql = _sql_do_upgrade()
    assert "ux_pedidos_idempotency" in sql
    assert re.search(r"created_by\s*,\s*idempotency_key", sql)


def test_indice_sem_concurrently():
    """Alembic roda dentro de transacao; CREATE INDEX CONCURRENTLY nao pode."""
    assert "CONCURRENTLY" not in _sql_do_upgrade().upper()
