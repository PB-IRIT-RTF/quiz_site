from __future__ import annotations

from datetime import timedelta
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import MediaKind, MediaSourceType, QuestionType, TextMatchType
from app.models.models import AdminUser, Option, Question, QuestionMedia, Quiz, TextAnswerRule
from app.services.timer import utcnow
from app.services.security import hash_password


async def seed_demo(db: AsyncSession) -> None:
    # Seed demo admin user (only if absent)
    admin_exists = (
        (await db.execute(select(AdminUser).where(AdminUser.username == "admin").limit(1))).scalar_one_or_none()
    )
    if admin_exists is None:
        # password can be overridden for demo
        demo_admin_password = os.getenv("DEMO_ADMIN_PASSWORD", "admin")
        db.add(AdminUser(username="admin", password_hash=hash_password(demo_admin_password), is_active=True))
        await db.commit()

    # Seed demo quiz only once
    existing_quiz = (await db.execute(select(Quiz).limit(1))).scalar_one_or_none()
    if existing_quiz:
        return

    now = utcnow()
    quiz = Quiz(
        id=1,
        title="Вселенная ИРИТ‑РТФ",
        start_at=now - timedelta(hours=1),
        end_at=now + timedelta(hours=6),
        published=True,
    )
    db.add(quiz)

    q1 = Question(
        quiz_id=quiz.id,
        order=1,
        type=QuestionType.single,
        text='Какой факультет проводит мероприятие "Вселенная ИРИТ‑РТФ"?',
        points=1,
        time_limit_seconds=25,
    )
    q1.options = [
        Option(text="ИРИТ‑РТФ", is_correct=True),
        Option(text="ФТИ", is_correct=False),
        Option(text="ФЭЛ", is_correct=False),
    ]
    q1.media = [
        QuestionMedia(
            kind=MediaKind.image,
            source_type=MediaSourceType.url,
            url="https://picsum.photos/seed/irit/900/380",
            title="Баннер (пример)",
            sort_order=1,
        )
    ]

    q2 = Question(
        quiz_id=quiz.id,
        order=2,
        type=QuestionType.multi,
        text="Отметьте форматы медиа, которые поддерживаются (всё или ничего).",
        points=2,
        time_limit_seconds=35,
    )
    q2.options = [
        Option(text="Картинки", is_correct=True),
        Option(text="Аудио", is_correct=True),
        Option(text="Видео", is_correct=True),
        Option(text="YouTube", is_correct=False),
    ]
    q2.media = [
        QuestionMedia(
            kind=MediaKind.audio,
            source_type=MediaSourceType.url,
            url="https://upload.wikimedia.org/wikipedia/commons/transcoded/4/45/En-us-quiz.ogg/En-us-quiz.ogg.mp3",
            title="Аудио (пример)",
            sort_order=1,
        )
    ]

    q3 = Question(
        quiz_id=quiz.id,
        order=3,
        type=QuestionType.text,
        text="Введите слово: ИРИТ (exact, без учёта регистра).",
        points=1,
        time_limit_seconds=None,
    )
    q3.text_rules = [
        TextAnswerRule(match_type=TextMatchType.exact, pattern="ирит", sort_order=1),
    ]
    q3.media = [
        QuestionMedia(
            kind=MediaKind.video,
            source_type=MediaSourceType.url,
            url="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
            title="Видео (пример)",
            sort_order=1,
            mime="video/mp4",
        )
    ]

    db.add_all([q1, q2, q3])
    await db.commit()
