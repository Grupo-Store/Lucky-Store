"""remove o UNIQUE de clientes.cnpj

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-08-20 00:00:00.000000

A regra de identidade de cliente passou a ser (mesmo nome E mesmo documento) —
ver app/services/cliente_identidade.py. Com isso, mesmo documento com nome
diferente são clientes distintos, o que um UNIQUE em `cnpj` impede: o INSERT
estoura com

    duplicate key value violates unique constraint "clientes_cnpj_key"

e o vendedor toma um 500 ao criar o pedido. O mesmo erro já acontecia hoje, sem
nenhuma mudança de regra, quando o cliente daquele CNPJ estava soft-deleted: a
busca filtra `deleted_at IS NULL` e não o encontra, mas o UNIQUE não liga para
soft delete e barra a inserção do mesmo jeito.

O constraint é descoberto pelo catálogo, e não pelo nome, porque bancos criados
por caminhos diferentes (create_all, DATABASE_INIT.sql) podem tê-lo nomeado de
formas diferentes, ou tê-lo como índice único sem constraint associado.

Idempotente: rodar de novo não faz nada.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'a5b6c7d8e9f0'
down_revision: Union[str, None] = 'f4a5b6c7d8e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) UNIQUE declarado como constraint (o caso do create_all e do
    #    DATABASE_INIT.sql), qualquer que seja o nome que ele recebeu.
    op.execute("""
        DO $$
        DECLARE r record;
        BEGIN
            FOR r IN
                SELECT con.conname
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_namespace ns ON ns.oid = rel.relnamespace
                WHERE rel.relname = 'clientes'
                  AND ns.nspname = current_schema()
                  AND con.contype = 'u'
                  AND (
                      -- attname e do tipo `name`; sem o ::text a comparacao com
                      -- ARRAY['cnpj'] (text[]) nao tem operador e a migration
                      -- estoura. Descoberto testando contra Postgres real.
                      SELECT array_agg(att.attname::text ORDER BY att.attname::text)
                      FROM unnest(con.conkey) AS k
                      JOIN pg_attribute att
                        ON att.attrelid = con.conrelid AND att.attnum = k
                  ) = ARRAY['cnpj']
            LOOP
                EXECUTE format('ALTER TABLE clientes DROP CONSTRAINT %I', r.conname);
            END LOOP;
        END $$;
    """)

    # 2) UNIQUE que exista apenas como índice, sem constraint por trás.
    op.execute("""
        DO $$
        DECLARE r record;
        BEGIN
            FOR r IN
                SELECT cls.relname AS indexname
                FROM pg_index idx
                JOIN pg_class cls ON cls.oid = idx.indexrelid
                JOIN pg_class tbl ON tbl.oid = idx.indrelid
                JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
                WHERE tbl.relname = 'clientes'
                  AND ns.nspname = current_schema()
                  AND idx.indisunique
                  AND NOT idx.indisprimary
                  AND NOT EXISTS (
                      SELECT 1 FROM pg_constraint con
                      WHERE con.conindid = idx.indexrelid
                  )
                  AND (
                      SELECT array_agg(att.attname::text ORDER BY att.attname::text)
                      FROM unnest(idx.indkey) AS k
                      JOIN pg_attribute att
                        ON att.attrelid = idx.indrelid AND att.attnum = k
                  ) = ARRAY['cnpj']
            LOOP
                EXECUTE format('DROP INDEX %I', r.indexname);
            END LOOP;
        END $$;
    """)

    # 3) A busca por cliente continua filtrando por cnpj — mantém o índice, só
    #    que sem a exclusividade.
    op.execute("CREATE INDEX IF NOT EXISTS ix_clientes_cnpj ON clientes (cnpj)")


def downgrade() -> None:
    # Sem volta automática: se dois clientes já dividirem um CNPJ — exatamente o
    # que esta migration passa a permitir — recriar o UNIQUE falharia no meio do
    # downgrade. Recriar à mão, depois de resolver as duplicatas, se algum dia
    # for preciso.
    pass
