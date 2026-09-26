import os
from typing import List, Literal
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="allow")

    APP_ENV: Literal["development", "test", "production"] = "development"
    PROJECT_NAME: str = "StockSense Inventory Management System"
    API_V1_STR: str = "/api/v1"

    # Secret Key for JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "stocksense-super-secret-key-production-ready-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Cookie config
    COOKIE_NAME: str = "stocksense_session"
    COOKIE_SECURE: bool = False  # Set to True in HTTPS production
    COOKIE_SAMESITE: str = "lax"  # lax for local dev / strict for same origin

    # Database URL: defaults to async SQLite, easily swappable with postgresql+asyncpg://...
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./stocksense.db")

    # CORS Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

    # Security & Rate Limiting
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_PER_HOUR: int = 5
    LOGIN_MAX_FAILED_ATTEMPTS: int = 10

    # SMTP (optional for local development; required in production)
    SMTP_HOST: str | None = None
    SMTP_PORT: int = Field(default=587, ge=1, le=65535)
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_STARTTLS: bool = True

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_FROM_EMAIL)

    @model_validator(mode="after")
    def validate_deployment_settings(self):
        if bool(self.SMTP_USERNAME) != bool(self.SMTP_PASSWORD):
            raise ValueError("SMTP_USERNAME and SMTP_PASSWORD must be configured together.")

        if self.APP_ENV != "production":
            return self

        errors = []
        if len(self.SECRET_KEY) < 32 or self.SECRET_KEY == "stocksense-super-secret-key-production-ready-2026":
            errors.append("set a unique SECRET_KEY of at least 32 characters")
        if not self.COOKIE_SECURE:
            errors.append("set COOKIE_SECURE=true")
        if not self.DATABASE_URL.startswith("postgresql+asyncpg://"):
            errors.append("set DATABASE_URL to a postgresql+asyncpg URL")
        if not self.CORS_ORIGINS or any(not origin.startswith("https://") for origin in self.CORS_ORIGINS):
            errors.append("set CORS_ORIGINS to HTTPS application origins")
        if not self.smtp_configured:
            errors.append("configure SMTP_HOST and SMTP_FROM_EMAIL")
        if not self.SMTP_STARTTLS:
            errors.append("set SMTP_STARTTLS=true")
        if errors:
            raise ValueError("Invalid production configuration: " + "; ".join(errors))
        return self

settings = Settings()
