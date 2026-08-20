"""
Regressão: a sequence que numera as OS precisa existir no metadata.

`_generate_numero_os()` faz SELECT nextval('pedido_os_seq'), mas essa sequence
não era criada em lugar nenhum — nem model, nem migration. Criar pedido sem
informar o número à mão falhava com UndefinedTable.

Estes testes travam o comportamento: se alguém tirar a Sequence do model, ou
mexer no cálculo do setval de um jeito que repita número de OS, quebram antes
de chegar em produção.
"""
import re
from pathlib import Path

import sqlalchemy as sa

from app.database import Base
from app.models.pedido import Pedido, pedido_os_seq  # noqa: F401  (registra o metadata)

SEQ_NAME = "pedido_os_seq"
MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic" / "versions" / "f4a5b6c7d8e9_create_pedido_os_seq.py"
)


def test_sequence_declarada_no_metadata():
    """É a associação com a MetaData que faz o create_all criar a sequence —
    sem ela, banco novo nasce sem contador e criar pedido quebra."""
    assert isinstance(pedido_os_seq, sa.Sequence)
    assert pedido_os_seq.name == SEQ_NAME
    assert pedido_os_seq.metadata is Base.metadata, (
        f"{SEQ_NAME} precisa estar anexada ao Base.metadata; sem isso o "
        "create_all não cria o contador e criar pedido falha com UndefinedTable"
    )


def test_create_all_emite_create_sequence():
    """Gera o DDL que o create_all emitiria no Postgres, sem tocar em banco."""
    comandos: list[str] = []
    engine = sa.create_mock_engine(
        "postgresql://",
        lambda sql, *a, **kw: comandos.append(str(sql.compile(dialect=engine.dialect))),
    )
    Base.metadata.create_all(engine, checkfirst=False)
    ddl = " ".join(comandos).upper()
    assert f"CREATE SEQUENCE {SEQ_NAME}".upper() in ddl


def test_service_usa_o_mesmo_nome_de_sequence():
    """Trava o acoplamento entre o nome no model e a string crua do service —
    renomear um sem o outro reintroduz exatamente o bug original."""
    servico = (
        Path(__file__).resolve().parents[1] / "app" / "services" / "pedido.py"
    ).read_text(encoding="utf-8")
    assert f"nextval('{SEQ_NAME}')" in servico


# ── Migration ─────────────────────────────────────────────────────────────────

def _sql_do_upgrade() -> str:
    corpo = MIGRATION.read_text(encoding="utf-8")
    corpo = corpo.split("def upgrade()")[1].split("def downgrade()")[0]
    return " ".join(
        (m[1] or m[2]) for m in
        re.findall(r'op\.execute\(\s*r?("""(.*?)"""|"(.*?)")\s*\)', corpo, re.S)
    )


def test_migration_cria_a_sequence_de_forma_idempotente():
    assert "CREATE SEQUENCE IF NOT EXISTS" in _sql_do_upgrade()


def test_migration_encadeia_no_head_anterior():
    assert "down_revision: Union[str, None] = 'e2f3a4b5c6d7'" in MIGRATION.read_text(
        encoding="utf-8"
    )


def test_setval_ignora_numero_os_fora_do_padrao():
    """numero_os é String e aceita valor digitado à mão. Sem o filtro, um
    'ORC-2024/7' qualquer entraria no MAX e o cast estouraria a migration."""
    sql = _sql_do_upgrade()
    assert "^OS-[0-9]+$" in sql, "falta o filtro que restringe ao formato OS-###"


def test_setval_considera_pedidos_soft_deleted():
    """Pedido apagado já consumiu o número e ele pode estar em documento
    impresso. Filtrar deleted_at aqui faria a numeração se repetir."""
    sql = _sql_do_upgrade()
    assert "deleted_at" not in sql


def test_soma_um_fora_do_greatest():
    """Regressão de um bug real no reparo da cotação: com o `+ 1` DENTRO do
    GREATEST, rodar a migration duas vezes devolve um número já entregue."""
    sql = _sql_do_upgrade()
    assert re.search(r"\)\s*\+\s*1\s*,\s*false", sql), (
        "o + 1 precisa ficar FORA do GREATEST, logo antes do is_called"
    )


def test_le_o_last_value_do_catalogo():
    """Ler `last_value` direto da sequence devolve 1 numa sequence nova, sem
    diferenciar 'nunca usada' de 'entregou o 1'. O catálogo devolve NULL."""
    sql = _sql_do_upgrade()
    assert "pg_sequences" in sql
    assert "FROM pedido_os_seq" not in sql


def test_contador_nunca_retrocede():
    assert "GREATEST" in _sql_do_upgrade()
