from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.utils.errors import OrderlyHubException
from app.api import router

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(OrderlyHubException)
async def orderly_hub_exception_handler(request: Request, exc: OrderlyHubException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


app.include_router(router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}
