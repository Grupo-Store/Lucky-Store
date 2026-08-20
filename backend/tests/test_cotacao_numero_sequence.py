"""
Regressão: a sequence que numera as cotações precisa estar declarada no model.

O migrate.py cria banco novo com Base.metadata.create_all() + alembic stamp
head. O stamp marca as migrations como aplicadas sem executá-las, então
qualquer objeto que exista apenas como SQL cru dentro delas nunca é criado.
Foi assim que `cotacao_numero_seq` sumiu e a criação de cotação passou a
falhar com UndefinedTable.

Estes testes travam esse comportamento: se alguém remover a Sequence do model,
eles quebram antes de chegar em produção.
"""
import re
from pathlib import Path

import sqlalchemy as sa

from app.models.cotacao import Cotacao

SEQ_NAME = "cotacao_numero_seq"
MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic" / "versions" / "e2f3a4b5c6d7_repair_cotacao_numero_seq.py"
)


def _ddl_do_create_all() -> list[str]:
    """Gera o DDL que o create_all emitiria no Postgres, sem tocar em banco."""
    comandos: list[str] = []
    engine = sa.create_mock_engine(
        "postgresql://",
        lambda sql, *a, **kw: comandos.append(
            str(sql.compile(dialect=engine.dialect))
        ),
    )
    Cotacao.__table__.create(engine, checkfirst=False)
    return comandos


def test_sequence_declarada_no_model():
    # A Sequence anexada à coluna vira o `default` dela no SQLAlchemy.
    default = Cotacao.__table__.c.numero.default
    assert isinstance(default, sa.Sequence), (
        "a coluna numero precisa ter uma Sequence como default"
    )
    assert default.name == SEQ_NAME


def test_create_all_emite_create_sequence():
    ddl = " ".join(_ddl_do_create_all()).upper()
    assert "CREATE SEQUENCE" in ddl, (
        "create_all precisa criar a sequence; sem isso um banco novo nasce "
        "sem o contador e a criação de cotação falha"
    )
    assert SEQ_NAME.upper() in ddl


def test_sequence_associada_a_metadata():
    """A sequence tem que pertencer à MetaData — é isso que faz o create_all
    considerá-la ao montar o schema inteiro, e não só esta tabela."""
    default = Cotacao.__table__.c.numero.default
    assert default.metadata is Cotacao.__table__.metadata


# ── Migration de reparo ───────────────────────────────────────────────────────

def _sql_do_upgrade() -> str:
    corpo = MIGRATION.read_text(encoding="utf-8")
    corpo = corpo.split("def upgrade()")[1].split("def downgrade()")[0]
    return " ".join(
        (m[1] or m[2]) for m in
        re.findall(r'op\.execute\(\s*("""(.*?)"""|"(.*?)")\s*\)', corpo, re.S)
    )


def test_reparo_cria_a_sequence_de_forma_idempotente():
    assert "CREATE SEQUENCE IF NOT EXISTS" in _sql_do_upgrade()


def test_reparo_soma_um_fora_do_greatest():
    """Regressão de um bug real: com o `+ 1` DENTRO do GREATEST, rodar a
    migration duas vezes reposicionava o contador num número já entregue e a
    numeração de cotações repetia. O `+ 1` tem que ficar fora."""
    sql = _sql_do_upgrade()
    assert re.search(r"\)\s*\+\s*1\s*,\s*false", sql), (
        "o + 1 precisa ficar FORA do GREATEST, logo antes do is_called"
    )
    assert not re.search(r"MAX\(numero\)\s*FROM\s*cotacoes\s*\)\s*,\s*0\s*\)\s*\+\s*1\s*,", sql), (
        "o + 1 voltou para dentro do GREATEST — isso repete número"
    )


def test_reparo_le_o_last_value_do_catalogo():
    """Ler `last_value` direto da sequence devolve 1 numa sequence nova, sem
    diferenciar 'nunca usada' de 'entregou o 1'. O catálogo devolve NULL nesse
    caso, que é o que torna o cálculo correto."""
    sql = _sql_do_upgrade()
    assert "pg_sequences" in sql
    assert "FROM cotacao_numero_seq" not in sql


def test_reparo_nunca_retrocede_o_contador():
    assert "GREATEST" in _sql_do_upgrade()
