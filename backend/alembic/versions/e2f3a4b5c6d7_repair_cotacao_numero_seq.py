"""repara a sequence cotacao_numero_seq em bancos onde ela não existe

Revision ID: e2f3a4b5c6d7
Revises: d6e7f8a9b0c1
Create Date: 2026-08-12 00:00:00.000000

Bancos criados pelo caminho "fresh database" do migrate.py passaram por
create_all() + alembic stamp head. O stamp marca as migrations como aplicadas
sem executá-las, e a sequence só existia como SQL cru dentro delas — nunca
chegou a ser criada. Resultado: criar cotação falhava com

    (psycopg2.errors.UndefinedTable) relation "cotacao_numero_seq" does not exist

Esta migration é idempotente e segura de rodar em banco saudável: quem já tem a
sequence não é afetado, porque tanto o CREATE quanto o setval só agem no que
falta.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'd6e7f8a9b0c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS cotacao_numero_seq")

    # Numera cotações que ficaram sem número (criadas enquanto o contador
    # faltava), continuando a partir do maior número já usado.
    op.execute("""
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
            FROM cotacoes WHERE numero IS NULL
        )
        UPDATE cotacoes c
        SET numero = o.rn + COALESCE((SELECT MAX(numero) FROM cotacoes), 0)
        FROM ordered o WHERE c.id = o.id
    """)

    # Posiciona o contador no próximo número livre.
    #
    # Cuidados aqui, todos verificados contra Postgres real:
    #
    # - `pg_sequences.last_value` é o último número JÁ ENTREGUE, e vem NULL
    #   quando a sequence nunca foi usada. Ler direto da sequence
    #   (SELECT last_value FROM cotacao_numero_seq) devolveria 1 numa sequence
    #   nova, o que é ambíguo — daí usar o catálogo.
    # - O +1 fica FORA do GREATEST, senão rodar a migration duas vezes devolve
    #   um número já usado.
    # - `is_called = false` faz o próximo nextval devolver exatamente este
    #   valor, em vez de valor+1.
    # - O GREATEST garante que o contador só avança, nunca retrocede: é o que
    #   torna a migration segura em banco saudável e idempotente.
    op.execute("""
        SELECT setval(
            'cotacao_numero_seq',
            GREATEST(
                COALESCE((SELECT MAX(numero) FROM cotacoes), 0),
                COALESCE((SELECT last_value FROM pg_sequences
                          WHERE schemaname = current_schema()
                            AND sequencename = 'cotacao_numero_seq'), 0)
            ) + 1,
            false
        )
    """)


def downgrade() -> None:
    # Reparo não tem volta: remover a sequence quebraria a criação de cotações.
    pass
