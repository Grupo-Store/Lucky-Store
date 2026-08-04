import json
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application configuration."""
    
    # App
    APP_NAME: str = "Orderly Hub API"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/orderly_hub"

    @property
    def database_url(self) -> str:
        # Railway injects postgresql:// but SQLAlchemy 2.x needs postgresql+psycopg2://
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url
    
    # JWT
    JWT_SECRET: str = "your-secret-key-change-in-production-min-32-chars-long"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS — stored as str to avoid pydantic-settings JSON-parsing the env var
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:8080"

    @property
    def allowed_origins_list(self) -> list:
        v = self.ALLOWED_ORIGINS
        if not v:
            return []
        try:
            return json.loads(v)
        except (json.JSONDecodeError, ValueError):
            return [s.strip() for s in v.split(",") if s.strip()]

    # TOTP (2FA) — mantido para compatibilidade com dados existentes
    TOTP_ISSUER: str = "OrderlyHub"
    TOTP_WINDOW: int = 1

    # Email (2FA via Mailgun)
    MAILGUN_API_KEY: str = ""
    MAILGUN_DOMAIN: str = ""
    EMAIL_CODE_EXPIRE_MINUTES: int = 5

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get settings instance."""
    return Settings()
