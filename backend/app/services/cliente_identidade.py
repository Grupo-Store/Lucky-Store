"""
Regra única de identidade de cliente.

Antes disto, três lugares decidiam de formas diferentes se um cliente já
existia:

- ``pedido.py``            — só por CNPJ, ignorando o nome digitado
- ``cotacao.py``           — só por CNPJ, e ainda RENOMEAVA o cliente existente
- ``conversao_cotacao.py`` — por CNPJ; sem CNPJ, por nome

Ou seja: o mesmo par (nome, documento) podia virar um cliente novo ou
reaproveitar outro dependendo de qual tela o vendedor usou. A regra passa a ser
uma só, definida pelo negócio:

    Dois clientes são o mesmo quando têm o MESMO NOME e o MESMO DOCUMENTO.
    Sem documento informado, são sempre clientes diferentes.

Consequência importante: mesmo documento com nome diferente são clientes
distintos. Isso é incompatível com um UNIQUE em ``clientes.cnpj`` — a migration
a5b6c7d8e9f0 remove esse constraint. Ver o comentário no model.
"""
import re
from typing import Iterable, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.cliente import Cliente


def normalizar_documento(valor: Optional[str]) -> str:
    """Reduz CPF/CNPJ ao que ele realmente é: os dígitos.

    O campo é texto livre e o mesmo documento chega escrito de formas
    diferentes ('11.111.111/1111-11', '11111111111111'). Comparar as strings
    cruas trataria as duas grafias como clientes distintos.
    """
    return re.sub(r"\D", "", valor or "")


def normalizar_nome(valor: Optional[str]) -> str:
    """Nome comparável: sem espaços nas pontas e sem diferença de caixa.

    Só isso — nada de aproximação por semelhança. 'Alpha' e 'Alpha Ltda'
    continuam sendo clientes diferentes, que é o comportamento pedido.

    Mantido de propósito equivalente a ``lower(btrim(nome))`` no Postgres, para
    que o filtro em SQL e a comparação em Python concordem.
    """
    return (valor or "").strip().lower()


def selecionar_cliente(
    candidatos: Iterable[Cliente],
    nome: str,
    documento: Optional[str],
) -> Optional[Cliente]:
    """Escolhe, entre os candidatos, o cliente que é 'o mesmo'. Função pura.

    Devolve ``None`` quando nenhum serve — inclusive quando não há documento,
    caso em que a regra manda tratar como cliente novo mesmo que exista alguém
    de nome idêntico.
    """
    doc = normalizar_documento(documento)
    if not doc:
        return None

    alvo = normalizar_nome(nome)
    for candidato in candidatos:
        if normalizar_nome(candidato.nome) != alvo:
            continue
        if normalizar_documento(candidato.cnpj) == doc:
            return candidato
    return None


def obter_ou_criar_cliente(
    db: Session,
    nome: str,
    documento: Optional[str],
) -> Cliente:
    """Devolve o cliente correspondente, criando-o se ainda não existir.

    Clientes apagados (soft delete) não entram na busca: um cadastro que o
    usuário removeu não deve ressurgir sozinho preso a um pedido novo.
    """
    doc = normalizar_documento(documento)

    if doc:
        # Filtra por nome no banco (barato, indexável) e confere o documento em
        # Python, onde a normalização de pontuação é possível.
        candidatos = (
            db.query(Cliente)
            .filter(
                Cliente.deleted_at.is_(None),
                Cliente.cnpj.isnot(None),
                func.lower(func.btrim(Cliente.nome)) == normalizar_nome(nome),
            )
            .all()
        )
        encontrado = selecionar_cliente(candidatos, nome, documento)
        if encontrado is not None:
            return encontrado

    cliente = Cliente(nome=nome, cnpj=(documento or None))
    db.add(cliente)
    db.flush()
    return cliente
