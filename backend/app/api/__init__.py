from fastapi import APIRouter
from app.api.routes.auth import router as auth_router
from app.api.routes.pedidos import router as pedidos_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(pedidos_router)
