import logging
import re
import uuid as _uuid
from typing import Optional

from fastapi import HTTPException, status

logger = logging.getLogger("app.erros")


class OrderlyHubException(Exception):
    """Base exception for Orderly Hub."""
    pass


class AuthenticationException(OrderlyHubException):
    """Authentication error."""
    
    def __init__(self, detail: str = "Invalid credentials"):
        self.detail = detail
        self.status_code = status.HTTP_401_UNAUTHORIZED


class AuthorizationException(OrderlyHubException):
    """Authorization error."""
    
    def __init__(self, detail: str = "Insufficient permissions"):
        self.detail = detail
        self.status_code = status.HTTP_403_FORBIDDEN


class NotFoundException(OrderlyHubException):
    """Resource not found."""
    
    def __init__(self, detail: str = "Resource not found"):
        self.detail = detail
        self.status_code = status.HTTP_404_NOT_FOUND


class ValidationException(OrderlyHubException):
    """Validation error."""
    
    def __init__(self, detail: str = "Validation failed"):
        self.detail = detail
        self.status_code = status.HTTP_422_UNPROCESSABLE_ENTITY


class BusinessLogicException(OrderlyHubException):
    """Business logic violation."""
    
    def __init__(self, detail: str = "Business logic violation"):
        self.detail = detail
        self.status_code = status.HTTP_400_BAD_REQUEST


def to_http_exception(exc: OrderlyHubException) -> HTTPException:
    """Convert OrderlyHubException to HTTPException."""
    return HTTPException(
        status_code=exc.status_code,
        detail=exc.detail
    )


# ── Erro de banco virando frase que o vendedor entende ────────────────────────
#
# As rotas faziam `except Exception as exc: HTTPException(400, str(exc))`. Para
# erro levantado pelo nosso proprio codigo isso funciona — a mensagem foi escrita
# por nos. Para erro vindo do banco, nao: `str(exc)` de um erro do psycopg2 e o
# dump inteiro, e o vendedor lia na tela
#
#   (psycopg2.errors.ForeignKeyViolation) insert or update on table "pedidos"
#   violates foreign key constraint "pedidos_id_cotacao_fkey"
#   DETAIL:  Key (id_cotacao)=(3f2a...) is not present in table "cotacoes".
#
# quando o que aconteceu foi: a cotacao de origem daquele pedido foi apagada.
#
# O que o banco informa e suficiente para dizer isso em portugues. O psycopg2
# expoe `.diag` com o nome da coluna, do constraint e o DETAIL; daqui sai o
# campo, e do campo sai o rotulo que a tela usa.

ROTULO_COLUNA: dict = {
    "id_loja": "Empresa",
    "id_vendedor": "Vendedor",
    "id_cliente": "Cliente",
    "id_cotacao": "Cotação de origem",
    "id_pedido": "Pedido",
    "id_pedido_origem": "Pedido de origem",
    "id_produto": "Produto",
    "id_rma": "RMA",
    "id_item_cotacao": "Item da cotação",
    "created_by": "Usuário que criou",
    "changed_by": "Usuário",
    "numero_os": "Nº da OS",
    "numero_nf": "Nº da NF",
    "numero_oc": "OC/AF/PED",
    "numero": "Número",
    "nome": "Nome",
    "nome_cliente": "Cliente",
    "email": "E-mail",
    "cnpj": "CNPJ",
    "cpf_cnpj": "CPF/CNPJ",
    "status": "Status",
    "valor_venda": "Valor de Venda",
    "valor_total": "Valor",
    "valor_projetado": "Custo Projetado",
    "valor_compra": "Valor de Compra",
    "preco_custo": "Preço de Custo",
    "data_pedido": "Data do Pedido",
    "data_entrega": "Data de Entrega",
    "data_cotacao": "Data da Cotação",
    "data_validade": "Data de Validade",
    "data_frete": "Data do Frete",
    "quantidade": "Quantidade",
    "descricao": "Descrição",
    "forma": "Forma de pagamento",
    "fornecedor": "Fornecedor",
    "entregador": "Entregador",
    "idempotency_key": "identificador da tentativa",
    "ip_address": "endereço de IP",
}


def _rotulo(coluna: str) -> str:
    return ROTULO_COLUNA.get(coluna, coluna.replace("_", " "))


def _colunas_do_erro(orig) -> list:
    """Qual(is) coluna(s) o banco apontou. Tres fontes, da melhor para a pior."""
    diag = getattr(orig, "diag", None)
    if diag is None:
        return []

    # 1. NOT NULL vem com a coluna explicita.
    coluna = getattr(diag, "column_name", None)
    if coluna:
        return [coluna]

    # 2. FK e UNIQUE trazem no DETAIL: Key (id_cotacao)=(...) is not present...
    detalhe = getattr(diag, "message_detail", None) or ""
    achado = re.search(r"Key \(([^)]+)\)=", detalhe)
    if achado:
        return [c.strip().strip('"') for c in achado.group(1).split(",")]

    # 3. Sobra o nome do constraint: pedidos_id_cotacao_fkey -> id_cotacao.
    nome = getattr(diag, "constraint_name", None) or ""
    tabela = getattr(diag, "table_name", None) or ""
    for sufixo in ("_fkey", "_key", "_check", "_pkey", "_excl"):
        if nome.endswith(sufixo):
            nome = nome[: -len(sufixo)]
            break
    if tabela and nome.startswith(tabela + "_"):
        nome = nome[len(tabela) + 1:]
    return [nome] if nome else []


# Colunas que existem para a maquina, nao para o vendedor. Citadas pelo nome
# viram ruido: "Ja existe outro registro com o mesmo valor em Usuário que criou,
# identificador da tentativa" e verdade e nao ajuda ninguem.
COLUNAS_INTERNAS = {"created_by", "changed_by", "idempotency_key", "ip_address",
                    "user_agent", "id", "created_at", "updated_at", "deleted_at"}


def _campos(orig) -> str:
    return ", ".join(_rotulo(c) for c in _colunas_do_erro(orig))


def _campos_visiveis(orig) -> str:
    """Só o que o vendedor reconhece da tela."""
    colunas = [c for c in _colunas_do_erro(orig) if c not in COLUNAS_INTERNAS]
    return ", ".join(_rotulo(c) for c in colunas)


def _mensagem_de_banco(orig) -> Optional[str]:
    """Frase para os erros de banco que sabemos explicar. None = nao sei.

    A comparacao e por NOME da classe, e nao por isinstance, de proposito: assim
    este modulo nao precisa importar psycopg2 — que nao esta instalado no
    ambiente de teste, onde o conftest aponta tudo para SQLite.

    Tudo em "Campo: frase" tambem de proposito. Alem de bater com o formato que
    o getApiError ja usa para os 422, evita concordancia de genero: "Cotação de
    origem não encontrado" ficaria errado, "Cotação de origem: registro não
    encontrado" nao tem esse problema em nenhum campo.
    """
    tipo = type(orig).__name__
    campos = _campos(orig)
    detalhe = getattr(getattr(orig, "diag", None), "message_detail", None) or ""

    if tipo == "ForeignKeyViolation":
        # Mesmo erro, dois sentidos opostos: ou o que eu aponto nao existe, ou
        # alguem aponta para o que eu quero apagar.
        if "is still referenced from table" in detalhe:
            return ("Não é possível excluir: ainda existem registros vinculados "
                    "a este item. Remova os vínculos antes.")
        return (f"{campos or 'Um dos vínculos'}: registro não encontrado. "
                "Pode ter sido excluído por outra pessoa — recarregue a página "
                "e tente de novo.")
    if tipo == "UniqueViolation":
        visiveis = _campos_visiveis(orig)
        if not visiveis:
            # Restricao so de colunas internas — o indice de idempotencia, por
            # exemplo. Nomea-las nao diria nada; o que houve foi repeticao.
            return "Este registro já foi salvo."
        return f"Já existe outro registro com o mesmo valor em {visiveis}."
    if tipo == "NotNullViolation":
        return f"{campos or 'Um dos campos obrigatórios'}: preenchimento obrigatório."
    if tipo == "CheckViolation":
        return f"{campos or 'Um dos campos'}: valor não permitido."
    # Nestes o Postgres costuma nao informar a coluna: nao ha DETAIL nem
    # column_name, so o tipo que estourou. Sem campo, frase inteira — "Um dos
    # campos: texto longo demais" nao e portugues.
    if tipo == "StringDataRightTruncation":
        return (f"{campos}: texto longo demais." if campos
                else "Um dos campos tem texto longo demais.")
    if tipo in ("InvalidTextRepresentation", "InvalidDatetimeFormat",
                "DatetimeFieldOverflow", "InvalidParameterValue"):
        return (f"{campos}: formato inválido." if campos
                else "Um dos campos está em formato inválido.")
    if tipo == "NumericValueOutOfRange":
        return (f"{campos}: número fora do limite aceito." if campos
                else "Um dos valores está fora do limite aceito.")
    if tipo in ("OperationalError", "InterfaceError", "AdminShutdown",
                "CannotConnectNow", "QueryCanceled"):
        return ("Falha de comunicação com o banco de dados. "
                "Tente de novo em instantes.")
    if tipo in ("DeadlockDetected", "SerializationFailure", "LockNotAvailable"):
        return ("O registro está sendo alterado por outra pessoa neste momento. "
                "Tente de novo em instantes.")
    return None


def _resumo(orig, exc: Exception) -> str:
    """Uma linha para o log.

    Usa a mensagem do driver (`orig`), nao a do SQLAlchemy: a do SQLAlchemy
    carrega junto o SQL e a lista de parametros ligados, que pode conter hash de
    senha e dado de cliente. A do driver e so o que o Postgres respondeu.
    """
    texto = str(orig).strip() or str(exc)
    return " ".join(texto.split())[:500]


def mensagem_de_erro(exc: Exception, acao: str = "concluir a operação") -> str:
    """Traduz qualquer excecao numa frase para a tela. Nunca vaza dump tecnico.

    O erro real vai para o log em todos os caminhos — trocar mensagem tecnica
    por mensagem legivel nao pode custar a capacidade de investigar depois.
    Quando nao sabemos explicar, a frase carrega um codigo curto que tambem esta
    no log: e por ele que se acha a linha exata quando o vendedor reclamar.
    """
    # Erro nosso, levantado de proposito: a mensagem ja foi escrita para ser lida.
    if isinstance(exc, OrderlyHubException):
        return getattr(exc, "detail", None) or str(exc) or "Não foi possível concluir a operação."

    codigo = _uuid.uuid4().hex[:6].upper()
    orig = getattr(exc, "orig", None) or exc
    conhecido = _mensagem_de_banco(orig)

    if conhecido is not None:
        logger.warning("[%s] falha ao %s: %s", codigo, acao, _resumo(orig, exc))
        return conhecido

    logger.error("[%s] erro nao tratado ao %s", codigo, acao, exc_info=exc)
    return (f"Não foi possível {acao}. Tente de novo — se continuar, "
            f"informe o código {codigo}.")


def erro_http(exc: Exception, acao: str,
              status_code: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    """O que as rotas usam no lugar de `HTTPException(400, str(exc))`.

    HTTPException passa intacta: se o codigo la dentro ja decidiu o status (401,
    404, 422), remarcar tudo como 400 seria perder informacao.

    O status das demais continua sendo o que a rota ja usava. Trocar por 404
    quando e NotFoundException seria mais correto, mas mudaria o contrato de
    rotas que a tela ja consome — fica para uma decisao separada.
    """
    if isinstance(exc, HTTPException):
        return exc
    return HTTPException(status_code=status_code, detail=mensagem_de_erro(exc, acao))
