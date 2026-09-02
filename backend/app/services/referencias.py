"""Conferencia de loja e vendedor antes de numerar.

Mora aqui, e nao dentro de um dos services, porque pedido e cotacao precisam da
mesma checagem pelo mesmo motivo — e duplica-la seria repetir exatamente o erro
do migrate_item_rma_status, onde uma copia da lista de status ficou para tras e
so foi descoberta meses depois.

O motivo: tanto numero_os quanto o numero da cotacao vem de nextval, que no
Postgres e nao-transacional de proposito — uma vez tirado, o rollback NAO
devolve o numero. Como a violacao de chave estrangeira so estoura no flush, que
acontece depois, cada tentativa com loja ou vendedor inexistente abria um buraco
permanente na numeracao.

Chamando isto antes de numerar, esses casos falham antes do nextval, e ainda com
mensagem legivel em vez do dump do psycopg2.
"""
import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.loja import Loja
from app.models.vendedor import Vendedor
from app.utils.errors import NotFoundException

logger = logging.getLogger("app.referencias")


def validar_loja_e_vendedor(db: Session, id_loja: UUID, id_vendedor: UUID) -> None:
    existe_loja = db.query(Loja.id).filter(
        Loja.id == id_loja, Loja.deleted_at.is_(None)
    ).first()
    if not existe_loja:
        # O UUID vai para o log, nao para a tela: para o vendedor ele nao quer
        # dizer nada, e para investigar (variavel de ambiente errada no Vercel,
        # loja excluida) e exatamente o que interessa.
        logger.warning("id_loja inexistente ou excluida: %s", id_loja)
        raise NotFoundException(
            "Empresa não encontrada. Ela pode ter sido excluída — "
            "recarregue a página e selecione de novo."
        )

    existe_vendedor = db.query(Vendedor.id).filter(
        Vendedor.id == id_vendedor, Vendedor.deleted_at.is_(None)
    ).first()
    if not existe_vendedor:
        logger.warning("id_vendedor inexistente ou excluido: %s", id_vendedor)
        raise NotFoundException(
            "Vendedor não encontrado. Ele pode ter sido excluído — "
            "recarregue a página e selecione de novo."
        )
