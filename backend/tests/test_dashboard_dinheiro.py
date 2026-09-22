"""Custo, lucro e margem tem que ser a MESMA conta nos quatro relatorios.

Havia tres contas diferentes para a palavra "custo" no mesmo dashboard:

  - card de KPI:            produto + adicionais + frete
  - grafico (serie diaria): produto + adicionais, sem frete
  - tabelas por empresa
    e por vendedor:         produto + servico, so

O mesmo pedido aparecia com tres lucros e tres margens na mesma tela. O efeito
pior era na meta: o card do vendedor compara o realizado contra a meta de lucro
usando a terceira conta, a mais frouxa — a meta era medida contra um lucro que
ignorava imposto, cartao, boleto e frete.

Junto vinham dois buracos:

  - o estorno de RMA abatia o faturamento so no card; o grafico e as tabelas
    somavam valor_venda cheio, e a soma das empresas fechava acima do total;
  - o frete era somado por fora, pela data dele, sem olhar o pedido: cancelar um
    pedido tirava a receita e deixava o frete como custo, e pedido excluido
    continuava pesando.

Estes testes rodam contra SQLite de verdade — os do dashboard que existiam
exigem um Postgres descartavel e ficam pulados na maquina de quem desenvolve,
que e onde este tipo de divergencia nasce.
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB, INET
from sqlalchemy.orm import Session

import app.models  # noqa: F401  — registra as tabelas
import app.models.despesa  # noqa: F401
import app.models.rma  # noqa: F401
import app.models.item_rma  # noqa: F401
import app.models.expense  # noqa: F401
from app.database import Base
from app.models import Pedido, CustoPedido, Frete, Loja, Vendedor, Cliente, User
from app.models.rma import Rma, RmaStatus
from app.models.item_rma import ItemRma
from app.services.dashboard import (
    get_kpis,
    get_breakdown_by_company,
    get_breakdown_by_seller,
    get_daily_series,
)


# Os tipos do Postgres precisam de um equivalente para o SQLite montar as
# tabelas. So a forma muda; as contas que estao sob teste sao as mesmas.
@compiles(PG_UUID, "sqlite")
def _uuid_sqlite(element, compiler, **kw):
    return "CHAR(36)"


@compiles(JSONB, "sqlite")
def _jsonb_sqlite(element, compiler, **kw):
    return "JSON"


@compiles(INET, "sqlite")
def _inet_sqlite(element, compiler, **kw):
    return "VARCHAR(45)"


HOJE = date.today()


class Cenario:
    """Um banco com uma loja, um vendedor e o que cada teste pendurar nele."""

    def __init__(self, db, loja, loja2, vendedor, vendedor2, cliente, user):
        self.db = db
        self.loja = loja
        self.loja2 = loja2
        self.vendedor = vendedor
        self.vendedor2 = vendedor2
        self.cliente = cliente
        self.user = user

    def pedido(self, venda, *, data=HOJE, loja=None, vendedor=None, cancelado=False,
               excluido=False, produto=0, imposto_venda=0, debito=0, boleto=0,
               servico=0, frete=0, frete_data=None):
        p = Pedido(
            id=uuid.uuid4(),
            id_loja=(loja or self.loja).id,
            id_vendedor=(vendedor or self.vendedor).id,
            id_cliente=self.cliente.id,
            numero_os=str(uuid.uuid4())[:8],
            data_pedido=data,
            data_entrega=data,
            status="Cancelled" if cancelado else "To Buy",
            is_cancelled=cancelado,
            created_by=self.user.id,
            valor_venda=Decimal(str(venda)),
            deleted_at=None,
        )
        if excluido:
            from datetime import datetime
            p.deleted_at = datetime.now()
        self.db.add(p)
        self.db.flush()
        self.db.add(CustoPedido(
            id_pedido=p.id,
            custo_produto_final=Decimal(str(produto)),
            custo_servico=Decimal(str(servico)),
            imposto_venda=Decimal(str(imposto_venda)),
            custo_debito=Decimal(str(debito)),
            custo_boleto=Decimal(str(boleto)),
        ))
        if frete:
            self.db.add(Frete(
                id=uuid.uuid4(), id_pedido=p.id, entregador="Entregador",
                valor=Decimal(str(frete)), data_frete=frete_data or data,
            ))
        self.db.commit()
        return p

    def estorno(self, pedido, valor, *, data=HOJE, vendedor=None, loja=None):
        rma = Rma(
            id=uuid.uuid4(),
            id_pedido_origem=pedido.id,
            id_vendedor=(vendedor or self.vendedor).id,
            id_loja=(loja or self.loja).id,
            numero_rma=str(uuid.uuid4())[:8],
            data_registro=data,
            status=RmaStatus.REEMBOLSO,
            created_by=self.user.id,
        )
        self.db.add(rma)
        self.db.flush()
        self.db.add(ItemRma(
            id=uuid.uuid4(), id_rma=rma.id, descricao="Devolvido", quantidade=1,
            valor_estornado=Decimal(str(valor)), data_estorno=data,
        ))
        self.db.commit()
        return rma

    # ── leitura: os quatro relatorios do mesmo periodo ──────────────────────
    def kpis(self, inicio=HOJE, fim=HOJE):
        return get_kpis(self.db, data_inicio=inicio, data_fim=fim)

    def empresas(self, inicio=HOJE, fim=HOJE):
        return get_breakdown_by_company(self.db, data_inicio=inicio, data_fim=fim).items

    def vendedores(self, inicio=HOJE, fim=HOJE):
        return get_breakdown_by_seller(self.db, data_inicio=inicio, data_fim=fim).items

    def dias(self, inicio=HOJE, fim=HOJE):
        return get_daily_series(self.db, data_inicio=inicio, data_fim=fim).items


@pytest.fixture
def cenario():
    engine = sa.create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        user = User(id=uuid.uuid4(), email="t@t.com", name="T", password_hash="x")
        loja = Loja(id=uuid.uuid4(), nome="Lucky Store")
        loja2 = Loja(id=uuid.uuid4(), nome="BTech")
        cliente = Cliente(id=uuid.uuid4(), nome="Cliente")
        db.add_all([user, loja, loja2, cliente])
        db.flush()
        vendedor = Vendedor(id=uuid.uuid4(), id_loja=loja.id, nome="Alcides")
        vendedor2 = Vendedor(id=uuid.uuid4(), id_loja=loja2.id, nome="Lucas")
        db.add_all([vendedor, vendedor2])
        db.commit()
        yield Cenario(db, loja, loja2, vendedor, vendedor2, cliente, user)
    Base.metadata.drop_all(engine)


class TestUmaContaSo:
    """O caso do relatorio: 10.000 de venda, 6.000 de produto, 500 de imposto,
    300 de debito, 50 de boleto e 200 de frete."""

    def pedido_do_exemplo(self, c):
        return c.pedido(10000, produto=6000, imposto_venda=500, debito=300, boleto=50, frete=200)

    def test_o_custo_e_o_mesmo_nos_quatro_relatorios(self, cenario):
        self.pedido_do_exemplo(cenario)
        esperado = Decimal("7050")  # 6.000 + 500 + 300 + 50 + 200
        assert cenario.kpis().custo == esperado
        assert cenario.empresas()[0].custo == esperado
        assert cenario.vendedores()[0].custo == esperado
        assert cenario.dias()[0].custo == esperado

    def test_o_lucro_e_o_mesmo_nos_quatro_relatorios(self, cenario):
        self.pedido_do_exemplo(cenario)
        esperado = Decimal("2950")
        assert cenario.kpis().lucro == esperado
        assert cenario.empresas()[0].lucro == esperado
        assert cenario.vendedores()[0].lucro == esperado
        assert cenario.dias()[0].lucro == esperado

    def test_a_margem_do_vendedor_nao_e_mais_generosa_que_a_do_card(self, cenario):
        # Era 40% no card do vendedor contra 29,5% no KPI — e a meta de lucro
        # era medida contra a de 40%.
        self.pedido_do_exemplo(cenario)
        assert cenario.kpis().margem == cenario.vendedores()[0].margem
        assert float(cenario.vendedores()[0].margem) == 0.295

    def test_o_frete_entra_no_custo_de_todos(self, cenario):
        cenario.pedido(1000, produto=100, frete=70)
        assert cenario.kpis().custo_frete == Decimal("70")
        assert cenario.dias()[0].fretes == Decimal("70")
        assert cenario.empresas()[0].custo == Decimal("170")


class TestPedidoCancelado:
    """Cancelar um pedido abate TODOS os custos dele, frete inclusive."""

    def test_cancelado_nao_deixa_frete_como_custo(self, cenario):
        cenario.pedido(5000, produto=1000, frete=300, cancelado=True)
        assert cenario.kpis().custo == 0
        assert cenario.kpis().custo_frete == 0
        assert cenario.kpis().receita == 0
        assert cenario.dias()[0].custo == 0
        assert cenario.dias()[0].fretes == 0

    def test_cancelar_um_nao_mexe_no_outro(self, cenario):
        cenario.pedido(10000, produto=6000, frete=200)
        cenario.pedido(5000, produto=1000, frete=300, cancelado=True)
        assert cenario.kpis().custo == Decimal("6200")
        assert cenario.kpis().receita == Decimal("10000")

    def test_pedido_excluido_nao_pesa_pelo_frete(self, cenario):
        cenario.pedido(5000, produto=1000, frete=300, excluido=True)
        assert cenario.kpis().custo == 0
        assert cenario.kpis().custo_frete == 0


class TestEstorno:
    """Estorno diminui o faturamento em todo lugar, nao so no card."""

    def test_desconta_nos_quatro_relatorios(self, cenario):
        p = cenario.pedido(10000, produto=6000)
        cenario.estorno(p, 2500)
        assert cenario.kpis().receita == Decimal("7500")
        assert cenario.empresas()[0].receita == Decimal("7500")
        assert cenario.vendedores()[0].receita == Decimal("7500")
        assert cenario.dias()[0].faturamento == Decimal("7500")

    def test_o_lucro_cai_junto(self, cenario):
        p = cenario.pedido(10000, produto=6000)
        cenario.estorno(p, 2500)
        assert cenario.kpis().lucro == Decimal("1500")
        assert cenario.empresas()[0].lucro == Decimal("1500")
        assert cenario.dias()[0].lucro == Decimal("1500")

    def test_a_soma_das_empresas_fecha_com_o_total(self, cenario):
        p1 = cenario.pedido(10000, produto=6000)
        cenario.pedido(4000, produto=1000, loja=cenario.loja2, vendedor=cenario.vendedor2)
        cenario.estorno(p1, 5000)
        total = cenario.kpis().receita
        assert sum(i.receita for i in cenario.empresas()) == total
        assert sum(i.receita for i in cenario.vendedores()) == total

    def test_estorno_cai_no_dia_em_que_aconteceu(self, cenario):
        ontem = HOJE - timedelta(days=1)
        p = cenario.pedido(10000, produto=0, data=ontem)
        cenario.estorno(p, 1000, data=HOJE)
        dias = {d.data: d for d in cenario.dias(inicio=ontem, fim=HOJE)}
        assert dias[ontem.isoformat()].faturamento == Decimal("10000")
        assert dias[HOJE.isoformat()].faturamento == Decimal("-1000")

    def test_estorno_de_pedido_antigo_aparece_na_empresa(self, cenario):
        # O pedido e de outro mes; o dinheiro saiu neste. Sem linha, a soma das
        # empresas ficaria acima do total e o estorno sumiria da tela.
        mes_passado = HOJE - timedelta(days=45)
        p = cenario.pedido(9000, produto=0, data=mes_passado)
        cenario.estorno(p, 700, data=HOJE)
        empresas = cenario.empresas()
        assert [i.receita for i in empresas] == [Decimal("-700")]
        assert sum(i.receita for i in empresas) == cenario.kpis().receita
