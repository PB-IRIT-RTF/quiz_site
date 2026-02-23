from __future__ import annotations

import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models.enums import AttemptStatus
from app.models.models import Attempt, Quiz
from app.services.demo_seed import seed_demo
from app.services.timer import utcnow


async def forced_finish_worker(stop_event: asyncio.Event) -> None:
    """Background task: every 10s forces finish of in_progress attempts when quiz.end_at is reached."""
    while not stop_event.is_set():
        try:
            async with AsyncSessionLocal() as db:
                now = utcnow()
                res = await db.execute(
                    select(Attempt, Quiz)
                    .join(Quiz, Quiz.id == Attempt.quiz_id)
                    .where(Attempt.status == AttemptStatus.in_progress, Quiz.end_at <= now)
                )
                rows = res.all()
                if rows:
                    for attempt, quiz in rows:
                        attempt.status = AttemptStatus.forced_finished
                        attempt.finished_at = now
                        if attempt.started_at:
                            attempt.total_time_ms = int((now - attempt.started_at).total_seconds() * 1000)
                        else:
                            attempt.total_time_ms = 0
                    await db.commit()
        except asyncio.CancelledError:
            raise
        except Exception:
            # не валим приложение из-за воркера
            pass

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=10)
        except asyncio.TimeoutError:
            continue


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()

    # Для локального запуска/демо поднимаем таблицы автоматически.
    # В проде используйте Alembic миграции.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    if settings.demo_seed:
        async with AsyncSessionLocal() as db:
            await seed_demo(db)

    stop_event = asyncio.Event()
    worker = asyncio.create_task(forced_finish_worker(stop_event))
    app.state._stop_event = stop_event
    app.state._worker = worker

    try:
        yield
    finally:
        stop_event.set()
        worker.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker


def create_app() -> FastAPI:
    if settings.environment != "dev":
        if settings.cookie_secret in {
            "dev-secret-change-me",
            "change-me-to-a-long-random-secret",
            "change-me",
        }:
            raise RuntimeError("Refusing to start with default COOKIE_SECRET outside dev environment")
        if settings.demo_seed:
            raise RuntimeError("Refusing to start with DEMO_SEED=true outside dev environment")
        if not settings.cookie_secure:
            raise RuntimeError("Refusing to start with COOKIE_SECURE=false outside dev environment")

    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    # CORS нужен если фронт запущен отдельным dev-сервером (Vite на :5173).
    # На Windows часто путают localhost и 127.0.0.1, а Origin должен совпасть ТОЧНО.
    origins = [o.strip() for o in (settings.frontend_origins or "").split(",") if o.strip()]

    # В dev разрешаем запросы с localhost/127.0.0.1 на любых портах, а также Origin: null
    # (например, если кто-то открыл dist/index.html через file://).
    allow_origin_regex = None
    if settings.environment == "dev":
        allow_origin_regex = r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?)$"

    # Всегда подключаем CORS: если origin не разрешён — CORSMiddleware сам отклонит.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=allow_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"]
    )

    app.include_router(api_router)

    # Опционально раздаём собранный фронт из dist/ без nginx/docker.
    # ВНИМАНИЕ: app.mount("/", ...) должен быть ПОСЛЕ include_router, иначе он перехватит /api/*.
    # if settings.serve_static:
    #     from pathlib import Path

    #     static_dir = Path(settings.static_dir)
    #     # Если запускают из корня репозитория, static_dir="../dist" не найдётся.
    #     # Поэтому пробуем несколько вариантов.
    #     candidates = [
    #         static_dir,
    #         Path(__file__).resolve().parents[2] / "dist",  # repo/dist
    #         Path(__file__).resolve().parents[3] / "dist",  # fallback
    #     ]
    #     dist = next((p for p in candidates if p.exists() and p.is_dir()), None)
    #     if dist is not None:
    #         app.mount("/", StaticFiles(directory=str(dist), html=True), name="static")

    return app


app = create_app()
