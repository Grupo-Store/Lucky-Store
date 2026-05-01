from fastapi import APIRouter
from app.api.routes.auth import router as auth_router
from app.api.routes.pedidos import router as pedidos_router
from app.api.routes.rma import router as rma_router
from app.api.routes.users import router as users_router
from app.api.routes.itens_pedido import router as itens_router
from app.api.routes.custos_pedido import router as custos_router
from app.api.routes.pagamentos_pedido import router as pagamentos_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(users_router)
router.include_router(pedidos_router)
router.include_router(rma_router)
router.include_router(itens_router)
router.include_router(custos_router)
router.include_router(pagamentos_router)
