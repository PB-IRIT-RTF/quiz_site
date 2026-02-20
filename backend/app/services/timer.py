from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AttemptStatus
from app.models.models import Attempt, AttemptAnswer, Question, Quiz


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def force_finish_if_quiz_ended(db: AsyncSession, quiz: Quiz, attempt: Attempt) -> None:
    now = utcnow()
    if now >= quiz.end_at and attempt.status == AttemptStatus.in_progress:
        attempt.status = AttemptStatus.forced_finished
        attempt.finished_at = now
        if attempt.started_at:
            attempt.total_time_ms = int((attempt.finished_at - attempt.started_at).total_seconds() * 1000)


async def advance_if_expired(db: AsyncSession, quiz: Quiz, attempt: Attempt) -> None:
    """
    Implements: if current question timer expired -> auto submit empty answer (if not already) and move forward.

    IMPORTANT: attempt should be locked (SELECT ... FOR UPDATE) by caller.
    """
    if attempt.status != AttemptStatus.in_progress:
        return

    await force_finish_if_quiz_ended(db, quiz, attempt)
    if attempt.status != AttemptStatus.in_progress:
        return

    while True:
        qres = await db.execute(
            select(Question).where(and_(Question.quiz_id == quiz.id, Question.order == attempt.current_question_order))
        )
        question = qres.scalar_one_or_none()
        if question is None:
            attempt.status = AttemptStatus.finished
            attempt.finished_at = utcnow()
            if attempt.started_at:
                attempt.total_time_ms = int((attempt.finished_at - attempt.started_at).total_seconds() * 1000)
            return

        if question.time_limit_seconds is None:
            return

        started_at = attempt.current_question_started_at or attempt.started_at
        if started_at is None:
            attempt.current_question_started_at = utcnow()
            return

        elapsed = (utcnow() - started_at).total_seconds()
        if elapsed < question.time_limit_seconds:
            return

        # expired: create empty answer if not exists
        ares = await db.execute(
            select(AttemptAnswer).where(
                and_(AttemptAnswer.attempt_id == attempt.id, AttemptAnswer.question_id == question.id)
            )
        )
        aa = ares.scalar_one_or_none()
        if aa is None:
            db.add(
                AttemptAnswer(
                    attempt_id=attempt.id,
                    question_id=question.id,
                    answer_json={"empty": True},
                    is_correct=False,
                    awarded_points=0,
                    auto_submitted=True,
                    time_spent_ms=int(question.time_limit_seconds * 1000),
                )
            )

        attempt.current_question_order += 1
        attempt.current_question_started_at = utcnow()
        # loop дальше (на случай, если пользователь пропустил много времени)
