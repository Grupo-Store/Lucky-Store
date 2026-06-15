from fastapi import APIRouter
from app.api.routes.auth import router as auth_router
from app.api.routes.pedidos import router as pedidos_router
from app.api.routes.rma import router as rma_router
from app.api.routes.users import router as users_router
from app.api.routes.itens_pedido import router as itens_router
from app.api.routes.custos_pedido import router as custos_router
from app.api.routes.pagamentos_pedido import router as pagamentos_router
from app.api.routes.cotacoes import router as cotacoes_router
from app.api.routes.item_cotacao import router as item_cotacao_router
from app.api.routes.conversao_cotacao import router as conversao_cotacao_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.expenses import router as expenses_router
from app.api.routes.despesas import router as despesas_router
from app.api.routes.calendar import router as calendar_router
from app.api.routes.fretes import router as fretes_router
from app.api.routes.vendedores import router as vendedores_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(pedidos_router)
router.include_router(rma_router)
router.include_router(users_router)
router.include_router(itens_router)
router.include_router(custos_router)
router.include_router(pagamentos_router)
router.include_router(cotacoes_router)
router.include_router(item_cotacao_router)
router.include_router(conversao_cotacao_router)
router.include_router(dashboard_router)
router.include_router(expenses_router)
router.include_router(despesas_router)
router.include_router(calendar_router)
router.include_router(fretes_router)
router.include_router(vendedores_router)
