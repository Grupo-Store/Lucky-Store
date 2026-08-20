import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, Date, DateTime, Text, Numeric, ForeignKey, Sequence  # type: ignore[import]
from sqlalchemy.dialects.postgresql import UUID, JSONB  # type: ignore[import]
from sqlalchemy.orm import relationship
from app.database import Base


# Contador que gera o numero de OS (OS-001, OS-002, ...), consumido por
# _generate_numero_os() em app/services/pedido.py.
#
# Declarado aqui, no metadata, e nao apenas como SQL cru dentro de uma
# migration, por dois motivos:
#
# 1. Esta sequence nunca chegou a existir em lugar nenhum do projeto - nem
#    model, nem migration. Todo banco, novo ou antigo, nascia sem ela, e criar
#    pedido sem informar o numero manualmente falhava com UndefinedTable.
# 2. O migrate.py cria banco novo com Base.metadata.create_all() + alembic
#    stamp head. O stamp marca as migrations como aplicadas sem executa-las,
#    entao o create_all so enxerga o que esta nos models. Anexar a Sequence ao
#    metadata e o que garante que um banco novo ja nasca com o contador.
pedido_os_seq = Sequence("pedido_os_seq", metadata=Base.metadata)


class Pedido(Base):
    __tablename__ = "pedidos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_loja = Column(UUID(as_uuid=True), ForeignKey("lojas.id"), nullable=False)
    id_vendedor = Column(UUID(as_uuid=True), ForeignKey("vendedores.id"), nullable=False)
    id_cliente = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False)
    # Cotação de origem (preenchido quando o pedido é criado a partir de uma conversão)
    id_cotacao = Column(UUID(as_uuid=True), ForeignKey("cotacoes.id"), nullable=True)

    numero_os = Column(String(50), nullable=False)
    numero_nf = Column(String(50), nullable=True)
    numero_oc = Column(String(50), nullable=True)

    data_pedido = Column(Date, nullable=False)
    data_entrega = Column(Date, nullable=False)
    status = Column(String(50), nullable=False, default="To Buy")

    is_rma = Column(Boolean, default=False)
    is_cancelled = Column(Boolean, default=False)
    is_direct_billing = Column(Boolean, default=False)

    valor_venda = Column(Numeric(12, 2), nullable=True)
    parcelas = Column(Integer, nullable=True)
    observacao = Column(Text, nullable=True)
    fornecedor_principal = Column(Text, nullable=True)
    nota_fiscal_fornecedor = Column(String(50), nullable=True)

    data_pagamento = Column(Date, nullable=True)
    multa = Column(Numeric(12, 2), nullable=True)
    juros = Column(Numeric(12, 2), nullable=True)
    forma_pagamento_efetiva = Column(String(50), nullable=True)
    num_parcelas_efetivas = Column(Integer, nullable=True)
    plano_parcelas = Column(JSONB, nullable=True)          # parcelas de multa/juros (Financeiro)
    plano_parcelas_pedido = Column(JSONB, nullable=True)   # parcelas do valor do pedido (Informações Gerais)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    loja = relationship("Loja", back_populates="pedidos")
    vendedor = relationship("Vendedor", back_populates="pedidos", foreign_keys=[id_vendedor])
    cliente = relationship("Cliente", back_populates="pedidos")
    formas_pagamento = relationship("PedidoFormaPagamento", back_populates="pedido", cascade="all, delete-orphan")
    custo = relationship("CustoPedido", back_populates="pedido", uselist=False, cascade="all, delete-orphan")
    fretes = relationship("Frete", back_populates="pedido", cascade="all, delete-orphan")
    produtos = relationship("Produto", back_populates="pedido", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Pedido {self.numero_os} status={self.status}>"


class PedidoFormaPagamento(Base):
    __tablename__ = "pedido_forma_pagamento"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_pedido = Column(UUID(as_uuid=True), ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False)
    forma = Column(String(50), nullable=False)

    pedido = relationship("Pedido", back_populates="formas_pagamento")


class CustoPedido(Base):
    __tablename__ = "custo_pedido"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_pedido = Column(UUID(as_uuid=True), ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False)

    custo_produto_inicial = Column(Numeric(12, 2), nullable=True)
    custo_produto_final = Column(Numeric(12, 2), nullable=True)
    custo_servico = Column(Numeric(12, 2), nullable=True)
    brinde = Column(Numeric(12, 2), nullable=True)
    pct_imposto_compra = Column(Numeric(5, 2), nullable=True)
    imposto_compra = Column(Numeric(12, 2), nullable=True)
    pct_imposto_venda = Column(Numeric(5, 2), nullable=True)
    imposto_venda = Column(Numeric(12, 2), nullable=True)
    pct_custo_credito = Column(Numeric(5, 2), nullable=True)
    custo_credito = Column(Numeric(12, 2), nullable=True)
    pct_custo_debito = Column(Numeric(5, 2), nullable=True)
    custo_debito = Column(Numeric(12, 2), nullable=True)
    custo_boleto = Column(Numeric(12, 2), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)

    pedido = relationship("Pedido", back_populates="custo")


class Frete(Base):
    __tablename__ = "frete"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_pedido = Column(UUID(as_uuid=True), ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=True)
    id_rma = Column(UUID(as_uuid=True), ForeignKey("rmas.id", ondelete="CASCADE"), nullable=True)

    valor = Column(Numeric(12, 2), nullable=False)
    entregador = Column(String(255), nullable=True)
    data_frete = Column(Date, nullable=False)
    pago = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)

    pedido = relationship("Pedido", back_populates="fretes")
