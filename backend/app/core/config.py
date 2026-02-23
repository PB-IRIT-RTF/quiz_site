from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/
_DATA_DIR = _BACKEND_DIR / "data"
_DATA_DIR.mkdir(parents=True, exist_ok=True)
_DEFAULT_SQLITE_PATH = _DATA_DIR / "quiz.db"
_DEFAULT_DATABASE_URL = f"sqlite+aiosqlite:///{_DEFAULT_SQLITE_PATH.as_posix()}"


class Settings(BaseSettings):
    # Для локального запуска без Docker:
    # - если uvicorn запускают из корня репозитория, ".env" будет в корне
    # - если запускают из backend/, ".env" будет в backend/
    # - как запасной вариант читаем backend/.env.example
    model_config = SettingsConfigDict(
        env_file=(
            ".env",
            str(_BACKEND_DIR / ".env"),
            str(_BACKEND_DIR / ".env.example"),
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Вселенная ИРИТ‑РТФ"
    environment: str = "dev"

    # По умолчанию — SQLite файл в backend/data/quiz.db (можно переопределить через env)
    # Важно: делаем абсолютный путь, чтобы работало при запуске uvicorn из разных рабочих директорий.
    database_url: str = Field(default=_DEFAULT_DATABASE_URL, validation_alias="DATABASE_URL")
    redis_url: str | None = Field(default=None, validation_alias="REDIS_URL")

    cookie_secret: str = Field(default="dev-secret-change-me", validation_alias="COOKIE_SECRET")
    cookie_secure: bool = Field(default=True, validation_alias="COOKIE_SECURE")

    # comma-separated origins (для Vite dev server). Важно: Vite часто открывают через 127.0.0.1
    # и тогда Origin будет http://127.0.0.1:5173 — поэтому добавляем оба варианта.
    frontend_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        validation_alias="FRONTEND_ORIGINS",
    )

    demo_seed: bool = Field(default=False, validation_alias="DEMO_SEED")

    admin_login_rate_limit_window_seconds: int = Field(default=300, validation_alias="ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS")
    admin_login_rate_limit_max_attempts: int = Field(default=10, validation_alias="ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS")
    admin_login_rate_limit_block_seconds: int = Field(default=900, validation_alias="ADMIN_LOGIN_RATE_LIMIT_BLOCK_SECONDS")
    admin_trust_x_forwarded_for: bool = Field(default=False, validation_alias="ADMIN_TRUST_X_FORWARDED_FOR")

    embed_allowed_hosts: str = Field(
        default="vk.com,www.vk.com,rutube.ru,www.rutube.ru,player.vimeo.com,dzen.ru,www.dzen.ru",
        validation_alias="EMBED_ALLOWED_HOSTS",
    )

    # Локальный “хостинг без Docker”: FastAPI может раздавать build фронта из dist/
    # (мы всё равно делаем fallback-поиск repo/dist в app.main).
    serve_static: bool = Field(default=True, validation_alias="SERVE_STATIC")
    static_dir: str = Field(default="dist", validation_alias="STATIC_DIR")


# Инициализируем настройки на import-time.
# Благодаря дефолтам (SQLite) backend может стартовать даже без .env.
settings = Settings()
