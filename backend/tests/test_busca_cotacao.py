"""A caixa de busca da tela de cotações procura no servidor, e por índice.

Antes ela filtrava só a página carregada, no navegador. Com 20 cotações por
página, digitar o índice 23 não achava nada se ele estivesse na página 2 — e
falhava em silêncio, o que é pior que não ter busca: quem digita conclui que a
cotação não existe.
"""
import re
import uuid
from pathlib import Path
from unittest.mock import patch

from app.api.routes.cotacoes import router as cotacoes_router
from app.services.cotacao import _filtro_de_busca

from tests.test_routes_cotacoes import _fake_cotacao, _COTACAO_PAYLOAD

BACKEND = Path(__file__).resolve().parents[1]
SERVICO = BACKEND / "app" / "services" / "cotacao.py"
TELA = BACKEND.parent / "src" / "pages" / "Sales.tsx"


# ── A rota repassa o termo ────────────────────────────────────────────────────

class TestRota:

    def test_repassa_a_busca_para_o_service(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.list",
                   return_value=([], 0, 0)) as mock_list:
            client.get("/quotes?busca=47")
        assert mock_list.call_args.kwargs["busca"] == "47"

    def test_sem_busca_o_parametro_vai_nulo(self, make_test_client, mock_db):
        client = make_test_client(cotacoes_router)
        with patch("app.api.routes.cotacoes.CotacaoService.list",
                   return_value=([], 0, 0)) as mock_list:
            client.get("/quotes")
        assert mock_list.call_args.kwargs["busca"] is None


# ── O filtro ──────────────────────────────────────────────────────────────────

def _sql(termo: str) -> str:
    """O SQL que o filtro gera, para inspecionar sem precisar de banco."""
    return str(_filtro_de_busca(termo).compile(compile_kwargs={"literal_binds": True}))


def test_procura_em_todos_os_campos_que_a_tela_prometia():
    """O placeholder diz "Cliente, Req, Empresa, Vendedor". Se o filtro do
    servidor cobrisse menos que isso, a busca passaria a achar MENOS do que
    achava quando era feita no navegador."""
    sql = _sql("santa")
    for campo in ("cliente", "b2b_company", "numero_requisicao"):
        assert campo in sql, f"faltou {campo}"
    assert "lojas" in sql, "faltou a loja (a coluna EMPRESA da tabela)"
    assert "vendedores" in sql, "faltou o vendedor"


def test_termo_numerico_casa_o_indice():
    assert "numero = 47" in _sql("47")


def test_indice_casa_exato_nunca_por_pedaco():
    """Por pedaço, digitar 6 devolveria 6, 16, 60..69 e a busca perderia a
    serventia — justamente para quem quer rastrear UMA cotação."""
    sql = _sql("6")
    # `numero` sozinho, sem o `_requisicao` que também começa com "numero".
    usos = re.findall(r"cotacoes\.numero\b(?!_)\s*(\S+)", sql)
    assert usos == ["="], f"a coluna numero aparece assim: {usos}"
    assert "cotacoes.numero = 6" in sql


def test_termo_de_texto_nao_tenta_casar_indice():
    assert "numero =" not in _sql("gustavo")


def test_numero_gigante_nao_chega_ao_banco():
    """Um termo de 30 dígitos viraria um número fora do range do integer e o
    Postgres estouraria. Ele continua valendo como texto."""
    sql = _sql("9" * 30)
    assert "numero =" not in sql
    assert "numero_requisicao" in sql


def test_numerico_procura_indice_E_numero_de_requisicao():
    """O caso que quase quebrei: tratar todo termo numérico como índice faria
    buscar 5137 parar de achar a cotação cujo Nº Req. é 5137. Os dois têm que
    estar na mesma consulta, ligados por OU."""
    sql = _sql("5137")
    assert "cotacoes.numero = 5137" in sql, "não procura por índice"
    assert "numero_requisicao) LIKE lower('%5137%')" in sql, "não procura por Nº Req."
    # As cinco condições de texto mais a do índice, todas no mesmo nível.
    assert sql.count(" OR ") >= 5, sql


# ── A tela não pode refiltrar por cima ────────────────────────────────────────

def test_a_tela_nao_refiltra_o_texto_no_navegador():
    """Refiltrar desfaria a busca do servidor: o índice casa exato lá e não
    aparece em nenhum dos campos de texto que a tela olhava."""
    fonte = TELA.read_text(encoding="utf-8")
    memo = fonte.split("const filteredQuotes = useMemo(")[1].split("}, [")[0]
    assert "quoteSearch" not in memo, (
        "o filtro de cotações voltou a olhar o texto digitado no navegador"
    )


def test_a_tela_manda_o_termo_para_o_servidor():
    fonte = TELA.read_text(encoding="utf-8")
    assert "busca: termo || undefined" in fonte
    assert "page: 1" in fonte, "a busca precisa voltar para a primeira página"
