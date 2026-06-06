from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    ENV: str = "development"

    DATABASE_URL: str = "postgresql://gatepass:gatepass@db:5432/gatepass"
    REDIS_URL: str = "redis://redis:6379/0"

    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    SWD_API_KEY: str = "swd-secret-api-key"

    APP_NAME: str = "BITS Gatepass"
    CORS_ORIGINS: str = "http://localhost:3000"

    OTP_TTL_SECONDS: int = 300       # 5 minutes
    QR_TTL_SECONDS: int = 600        # 10 minutes
    PERMANENT_PASS_TTL_DAYS: int = 365

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def is_development(self) -> bool:
        return self.ENV == "development"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
