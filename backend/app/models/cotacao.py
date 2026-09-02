import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Date, DateTime, ForeignKey, UniqueConstraint, Integer, Sequence, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import Numeric
from sqlalchemy.orm import relationship
from app.database import Base


# Contador que numera as cotações, consumido por _generate_numero() em
# app/services/cotacao.py. Ver o comentário da coluna `numero` sobre por que
# ele mora na metadata e não na coluna.
cotacao_numero_seq = Sequence("cotacao_numero_seq", metadata=Base.metadata)


class Cotacao(Base):
    __tablename__ = "cotacoes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_loja = Column(UUID(as_uuid=True), ForeignKey("lojas.id"), nullable=False)
    id_vendedor = Column(UUID(as_uuid=True), ForeignKey("vendedores.id"), nullable=False)

    # Número sequencial de registro (1, 2, 3, ...), atribuído pelo service.
    #
    # A Sequence está ANEXADA À METADATA, e não à coluna, e a diferença importa.
    #
    # Ela precisa estar no model por causa do migrate.py, que cria banco novo
    # com Base.metadata.create_all() + alembic stamp head: o stamp marca as
    # migrations como aplicadas sem executá-las, então o create_all só enxerga
    # o que está nos models. Sem isso o contador não nasce e criar cotação
    # falha com UndefinedTable em nextval('cotacao_numero_seq').
    #
    # Mas presa à COLUNA, como estava, ela também vira o `default` dela: o
    # SQLAlchemy passa a chamar nextval sozinho a cada INSERT em que `numero`
    # vem None. Isso derrotava a correção que tira o número só depois do INSERT
    # — o INSERT já trazia um nextval embutido, e toda tentativa recusada pelo
    # banco (uq_cotacao, chave de idempotência repetida) queimava um número
    # mesmo assim. Medido: uma criação normal consumia 2 números, e uma corrida
    # de 4 requisições consumia 4.
    #
    # Na metadata, o create_all continua criando a sequence e o INSERT não puxa
    # mais nada por conta própria. É o mesmo arranjo de pedido_os_seq.
    numero = Column(Integer, nullable=True)

    numero_requisicao = Column(String(50), nullable=True)
    b2b_company = Column(String(255), nullable=True)
    cliente = Column(String(255), nullable=False)
    cnpj_cliente = Column(String(20), nullable=True)

    data_cotacao = Column(Date, nullable=False)
    data_validade = Column(Date, nullable=True)

    # Phases
    status_enviada = Column(Boolean, default=False)
    data_envio = Column(Date, nullable=True)
    status_em_fechamento = Column(Boolean, default=False)
    data_prevista_fechamento = Column(Date, nullable=True)
    status_fechada = Column(Boolean, default=False)
    data_fechamento = Column(Date, nullable=True)
    valor_fechamento = Column(Numeric(12, 2), nullable=True)
    status_caida = Column(Boolean, default=False)
    data_queda = Column(Date, nullable=True)

    is_direct_billing = Column(Boolean, default=False)
    fornecedor = Column(String(255), nullable=True)
    valor_total = Column(Numeric(12, 2), nullable=True)

    observacao = Column(Text, nullable=True)
    pct_imposto_lucky = Column(Numeric(5, 2), nullable=True)
    pct_imposto_btech = Column(Numeric(5, 2), nullable=True)

    # Envio de cotação
    data_entrega = Column(Date, nullable=True)
    previsao_entrega = Column(Date, nullable=True)
    forma_pagamento = Column(String(50), nullable=True)
    detalhes_pagamento = Column(Text, nullable=True)
    prazo_pagamento = Column(Date, nullable=True)
    garantia = Column(Text, nullable=True)

    # Chave de idempotencia: identifica a TENTATIVA de salvar, nao a cotacao.
    # Mesma logica do pedido (app/models/pedido.py): a tela gera uma por clique
    # em salvar e reusa a mesma se precisar tentar de novo; vendo uma chave que
    # ja criou cotacao, o backend devolve aquela em vez de criar outra.
    #
    # Aqui importa ainda mais por causa da uq_cotacao logo abaixo: tentativa
    # duplicada e recusada pelo banco DEPOIS de o numero ja ter saido do
    # nextval, entao cada recusa custava um numero.
    idempotency_key = Column(String(64), nullable=True)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("id_loja", "id_vendedor", "data_cotacao", "numero_requisicao", name="uq_cotacao"),
        # Unico POR USUARIO: a chave de um vendedor nunca devolve a cotacao de
        # outro. NULL != NULL em Postgres, entao cotacao antiga ou criada por
        # caminho sem chave nao colide. E a exclusividade — nao a busca — que
        # segura dois cliques simultaneos.
        Index("ux_cotacoes_idempotency", "created_by", "idempotency_key", unique=True),
    )

    loja = relationship("Loja", back_populates="cotacoes")
    vendedor = relationship("Vendedor", back_populates="cotacoes", foreign_keys=[id_vendedor])
    itens = relationship("ItemCotacao", back_populates="cotacao", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Cotacao {self.numero_requisicao} - {self.cliente}>"
