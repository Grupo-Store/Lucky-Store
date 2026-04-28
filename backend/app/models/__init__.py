# ORM Models — todos importados aqui para o SQLAlchemy resolver os relacionamentos
from app.models.user import User
from app.models.loja import Loja
from app.models.vendedor import Vendedor
from app.models.cliente import Cliente
# Duda (rma, item_rma, cotacao, item_cotacao — pendente merge)
# Gustavo (pedidos, produtos, custo_pedido, frete — pendente merge)
# Peu (venda_vendedor, compra_vendedor, meta_vendedor, status_history, audit_log — pendente merge)

__all__ = [
    "User",
    "Loja",
    "Vendedor",
    "Cliente",
]
