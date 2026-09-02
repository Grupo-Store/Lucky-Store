"""chave de idempotencia na criacao de pedido

Revision ID: b7c8d9e0f1a2
Revises: a5b6c7d8e9f0
Create Date: 2026-09-02 00:00:00.000000

O numero da OS vem de nextval('pedido_os_seq'), e sequence no Postgres nao volta
no rollback: todo POST /pedidos que chega ao banco gasta um numero, tenha o
pedido sido criado ou nao. Duas correcoes ja entraram antes desta:

  - a5b6c7d8e9f0 / _validar_referencias: loja ou vendedor inexistente passa a
    falhar ANTES do nextval;
  - client.ts: reenvio automatico deixou de valer para POST/PUT/PATCH/DELETE.

Sobrava o caso em que a criacao da certo e apenas a RESPOSTA se perde. A tela
nao distingue isso de uma falha, e a segunda tentativa criava um pedido gemeo,
com outro numero de OS. Nenhuma checagem previa resolve, porque a requisicao e
legitima — o que falta e o backend reconhecer que ja a atendeu.

A coluna guarda a chave que a tela gera por tentativa de salvar. O indice unico
e por (created_by, idempotency_key): a chave de um vendedor nunca devolve o
pedido de outro, e NULL != NULL em Postgres, entao pedido antigo ou criado por
caminho sem chave (conversao de cotacao, seed) nao colide.

Idempotente de proposito — rodar de novo nao faz nada.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, None] = 'a5b6c7d8e9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64)"
    )
    # Sem CONCURRENTLY: alembic roda dentro de transacao, e CONCURRENTLY nao
    # pode. A tabela e pequena (centenas de linhas) e o lock dura milissegundos.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_pedidos_idempotency "
        "ON pedidos (created_by, idempotency_key)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_pedidos_idempotency")
    op.execute("ALTER TABLE pedidos DROP COLUMN IF EXISTS idempotency_key")
