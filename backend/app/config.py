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
    
    # JWT
    JWT_SECRET: str = "your-secret-key-change-in-production-min-32-chars-long"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:3000", "http://localhost:5173"]
    
    # TOTP (2FA)
    TOTP_ISSUER: str = "OrderlyHub"
    TOTP_WINDOW: int = 1
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get settings instance."""
    return Settings()
