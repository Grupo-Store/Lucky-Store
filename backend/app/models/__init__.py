# ORM Models — todos importados aqui para o SQLAlchemy resolver os relacionamentos
from app.models.user import User
from app.models.loja import Loja
from app.models.vendedor import Vendedor
from app.models.cliente import Cliente
from app.models.rma import Rma, RmaStatus
from app.models.item_rma import ItemRma, ItemRmaStatus
from app.models.cotacao import Cotacao
from app.models.item_cotacao import ItemCotacao
from app.models.pedido import Pedido, PedidoFormaPagamento, CustoPedido, Frete
from app.models.produto import Produto
from app.models.venda_vendedor import VendaVendedor
from app.models.compra_vendedor import CompraVendedor
from app.models.meta_vendedor import MetaVendedor
from app.models.status_history import StatusHistory, EntityType
from app.models.audit_log import AuditLog, AuditAction
from app.models.email_verification import EmailVerificationCode

__all__ = [
    "User",
    "Loja",
    "Vendedor",
    "Cliente",
    "Rma", "RmaStatus",
    "ItemRma", "ItemRmaStatus",
    "Cotacao",
    "ItemCotacao",
    "VendaVendedor",
    "CompraVendedor",
    "MetaVendedor",
    "StatusHistory", "EntityType",
    "AuditLog", "AuditAction",
    "Pedido", "PedidoFormaPagamento", "CustoPedido", "Frete",
    "Produto",
    "EmailVerificationCode",
]
