"""chave de idempotencia na criacao de cotacao

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-09-02 00:00:00.000000

Espelha b7c8d9e0f1a2, que fez o mesmo para pedidos. A cotacao tem contador
proprio (cotacao_numero_seq) e sofria dos mesmos tres problemas: numero saindo
antes do INSERT, loja/vendedor conferidos tarde demais, e nenhuma forma de
reconhecer uma tentativa repetida quando a resposta se perde.

Medido no banco de producao no dia deste commit: 47 cotacoes, contador em 64 —
17 numeros (10 a 26) entregues e nunca usados. O bloco e contiguo, entao a maior
parte veio de um evento unico anterior ao reparo da sequence (e2f3a4b5c6d7), e
nao de tentativas espalhadas. Mas o mecanismo que queimou continua no codigo, e
a restricao uq_cotacao (loja + vendedor + data + nº de requisicao) faz dele algo
que dispara sozinho: cotacao duplicada e recusada pelo banco DEPOIS do nextval.

Idempotente de proposito — rodar de novo nao faz nada.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64)"
    )
    # Sem CONCURRENTLY: alembic roda dentro de transacao, e CONCURRENTLY nao
    # pode. A tabela e pequena e o lock dura milissegundos.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_cotacoes_idempotency "
        "ON cotacoes (created_by, idempotency_key)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_cotacoes_idempotency")
    op.execute("ALTER TABLE cotacoes DROP COLUMN IF EXISTS idempotency_key")
