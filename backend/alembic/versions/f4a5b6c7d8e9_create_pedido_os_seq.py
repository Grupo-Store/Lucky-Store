"""cria a sequence pedido_os_seq, que nunca existiu em banco nenhum

Revision ID: f4a5b6c7d8e9
Revises: e2f3a4b5c6d7
Create Date: 2026-08-20 00:00:00.000000

`_generate_numero_os()` faz SELECT nextval('pedido_os_seq'), mas essa sequence
não era criada em lugar nenhum do projeto — não estava em model nem em
migration. Ao contrário de `cotacao_numero_seq`, que existia nas migrations e
só era pulada pelo `alembic stamp` do caminho "fresh database", esta aqui
simplesmente nunca foi escrita. Todo banco, novo ou antigo, nascia sem ela.

O erro só aparecia quando o pedido era criado sem número de OS informado à mão
(`data.numero_os or _generate_numero_os(db)`), o que mascarou o problema:

    (psycopg2.errors.UndefinedTable) relation "pedido_os_seq" does not exist

Idempotente e segura em banco saudável: o CREATE não age se já houver sequence,
e o setval só faz o contador avançar.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS pedido_os_seq")

    # Posiciona o contador depois do maior OS já usado, para não gerar um
    # numero_os que colida com pedido existente (a coluna não tem UNIQUE, então
    # a colisão passaria silenciosa e viraria dor de cabeça no operacional).
    #
    # Cuidados, os mesmos validados no reparo de cotacao_numero_seq:
    #
    # - `numero_os` é String e aceita valor digitado à mão, que pode não seguir
    #   o formato OS-###. O filtro `~ '^OS-[0-9]+$'` considera só o que a
    #   sequence realmente gerou; qualquer outra coisa é ignorada.
    # - Pedidos com deleted_at preenchido CONTAM. O número já foi usado e
    #   aparece em documento impresso — reciclá-lo criaria dois pedidos com a
    #   mesma OS.
    # - `pg_sequences.last_value` vem NULL em sequence nunca usada; ler
    #   `last_value` direto da sequence devolveria 1 e não distinguiria
    #   "nunca usada" de "já entregou o 1".
    # - O `+ 1` fica FORA do GREATEST, senão rodar a migration duas vezes
    #   reposiciona o contador num número já entregue.
    # - `is_called = false` faz o próximo nextval devolver exatamente este
    #   valor, em vez de valor + 1.
    op.execute(r"""
        SELECT setval(
            'pedido_os_seq',
            GREATEST(
                COALESCE((
                    SELECT MAX(substring(numero_os from '^OS-0*([0-9]+)$')::bigint)
                    FROM pedidos
                    WHERE numero_os ~ '^OS-[0-9]+$'
                ), 0),
                COALESCE((SELECT last_value FROM pg_sequences
                          WHERE schemaname = current_schema()
                            AND sequencename = 'pedido_os_seq'), 0)
            ) + 1,
            false
        )
    """)


def downgrade() -> None:
    # Reparo não tem volta: remover a sequence quebraria a criação de pedidos.
    pass
