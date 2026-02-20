from __future__ import annotations

import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    origins = [o.strip() for o in (settings.frontend_origins or "").split(",") if o.strip()]
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"] ,
            allow_headers=["*"],
        )

    app.include_router(api_router)
    return app


app = create_app()
