"""Lógica compartilhada de clientes.

Centraliza a busca e o upsert por CPF/CNPJ para que pedidos, cotações e o
autocomplete usem exatamente a mesma regra de comparação — por dígitos,
ignorando pontuação.
"""
import re
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.cliente import Cliente

_NON_DIGITS = re.compile(r"\D")


def only_digits(value: Optional[str]) -> str:
    """Remove tudo que não for dígito."""
    return _NON_DIGITS.sub("", value or "")


def find_cliente_by_documento(db: Session, documento: Optional[str]) -> Optional[Cliente]:
    """Busca um cliente pelo CPF/CNPJ comparando apenas os dígitos.

    Documentos gravados antes da máscara existir podem estar com pontuação
    inconsistente ("12345678000190" vs "12.345.678/0001-90"). Normalizar na
    consulta faz os dois casarem sem precisar alterar dado existente.
    """
    digits = only_digits(documento)
    if not digits:
        return None

    return (
        db.query(Cliente)
        .filter(
            func.regexp_replace(Cliente.cnpj, r"[^0-9]", "", "g") == digits,
            Cliente.deleted_at.is_(None),
        )
        .order_by(Cliente.created_at.asc())
        .first()
    )


def upsert_cliente(
    db: Session,
    nome: str,
    documento: Optional[str],
    empresa: Optional[str] = None,
) -> Optional[Cliente]:
    """Cria o cliente ou atualiza os dados do já existente.

    Só sobrescreve `nome`/`empresa` quando vem um valor novo e não vazio, para
    que um formulário preenchido pela metade não apague dado bom que já estava
    salvo. Retorna `None` quando não há documento nem nome.
    """
    cliente = find_cliente_by_documento(db, documento)

    if cliente is None:
        if not nome and not documento:
            return None
        cliente = Cliente(
            nome=nome or (empresa or ""),
            empresa=empresa or None,
            cnpj=documento or None,
        )
        db.add(cliente)
        db.flush()
        return cliente

    if nome and cliente.nome != nome:
        cliente.nome = nome
    if empresa and cliente.empresa != empresa:
        cliente.empresa = empresa

    # O `cnpj` gravado NÃO é reescrito de propósito. A coluna é UNIQUE e a base
    # pode ter dois registros com os mesmos dígitos e pontuação diferente
    # ("12345678000190" e "12.345.678/0001-90"). Reformatar um deles faria ele
    # colidir com o outro e derrubar o salvamento com IntegrityError.
    # A busca já compara por dígitos, então o formato armazenado é irrelevante.

    return cliente
