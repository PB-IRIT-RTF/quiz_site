from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Вселенная ИРИТ‑РТФ"
    environment: str = "dev"

    database_url: str
    redis_url: str | None = None

    cookie_secret: str = "dev-secret-change-me"
    cookie_secure: bool = False
    frontend_origins: str = "http://localhost:5173"

    demo_seed: bool = True


settings = Settings()
