from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.enums import AttemptStatus, QuestionType
from app.models.models import Attempt, AttemptAnswer, Participant, Question, Quiz, TextAnswerRule
from app.schemas.public import (
    ActiveQuizResponse,
    AnswerCurrentQuestionRequest,
    AnswerCurrentQuestionResponse,
    AttemptStartResponse,
    CurrentQuestionResponse,
    HealthResponse,
    LeaderboardResponse,
    LeaderboardRow,
    ParticipantRegisterRequest,
    ParticipantRegisterResponse,
    QuestionMediaDto,
    QuestionPublicDto,
    QuizDto,
    ResultResponse,
)
from app.services import scoring
from app.services.auth import COOKIE_NAME, cookie_params, create_participant_token, get_participant_id_from_cookie
from app.services.normalize import fio_to_display, normalize_nickname, normalize_vk_url
from app.services.timer import advance_if_expired, force_finish_if_quiz_ended, ensure_utc, utcnow


router = APIRouter()


def _quiz_state(quiz: Quiz | None, now: datetime) -> tuple[str, Quiz | None]:
    if quiz is None:
        return "none", None

    # Нормализуем даты (SQLite -> naive, приводим к UTC-aware)
    now_u = ensure_utc(now)
    start_u = ensure_utc(quiz.start_at)
    end_u = ensure_utc(quiz.end_at)

    if not quiz.published:
        return "unpublished", quiz
    if now_u < start_u:
        return "not_started", quiz
    if now_u >= end_u:
        return "ended", quiz
    return "running", quiz


async def _pick_quiz(db: AsyncSession) -> Quiz | None:
    # 1) если есть опубликованный — берём последний опубликованный
    res = await db.execute(select(Quiz).where(Quiz.published.is_(True)).order_by(Quiz.created_at.desc()).limit(1))
    q = res.scalar_one_or_none()
    if q:
        return q
    # 2) иначе берём просто последний (для state=unpublished)
    res2 = await db.execute(select(Quiz).order_by(Quiz.created_at.desc()).limit(1))
    return res2.scalar_one_or_none()


def _participant_id_dep(token: str | None = Cookie(default=None, alias=COOKIE_NAME)) -> int:
    return get_participant_id_from_cookie(token)


async def _get_attempt_for_update(db: AsyncSession, quiz_id: int, participant_id: int) -> Attempt | None:
    res = await db.execute(
        select(Attempt)
        .where(and_(Attempt.quiz_id == quiz_id, Attempt.participant_id == participant_id))
        .with_for_update()
    )
    return res.scalar_one_or_none()


async def _count_questions(db: AsyncSession, quiz_id: int) -> int:
    return int(
        (await db.execute(select(func.count()).select_from(Question).where(Question.quiz_id == quiz_id))).scalar_one()
    )


def _total_time_ms(started_at: datetime | None, now: datetime) -> int:
    if not started_at:
        return 0
    now_u = ensure_utc(now)
    started_u = ensure_utc(started_at)
    return int(max(0, (now_u - started_u).total_seconds() * 1000))


def _finish_attempt(attempt: Attempt, now: datetime) -> None:
    attempt.status = AttemptStatus.finished
    attempt.finished_at = now
    attempt.total_time_ms = _total_time_ms(attempt.started_at, now)


def _public_question_dto(q: Question) -> QuestionPublicDto:
    options = None
    if q.type in (QuestionType.single, QuestionType.multi):
        options = [{"id": o.id, "text": o.text} for o in q.options]

    media = [
        QuestionMediaDto(
            id=m.id,
            kind=m.kind.value,
            source_type=m.source_type.value,
            url=m.url,
            mime=m.mime,
            title=m.title,
            sort_order=m.sort_order,
        )
        for m in (q.media or [])
    ]

    return QuestionPublicDto(
        id=q.id,
        order=q.order,
        type=q.type.value,
        text=q.text,
        points=q.points,
        time_limit_seconds=q.time_limit_seconds,
        options=options,
        media=media,
    )


def _time_left_seconds(attempt: Attempt, question: Question) -> int | None:
    if question.time_limit_seconds is None:
        return None

    started_at = attempt.current_question_started_at or attempt.started_at
    if not started_at:
        return question.time_limit_seconds

    # Нормализуем: SQLite может вернуть naive, приводим всё к UTC-aware
    now_u = ensure_utc(utcnow())
    started_u = ensure_utc(started_at)

    elapsed = (now_u - started_u).total_seconds()
    left = int(question.time_limit_seconds - int(elapsed))
    return max(0, min(question.time_limit_seconds, left))


async def _leaderboard_subq(db: AsyncSession, quiz_id: int):
    # RANK() OVER (ORDER BY score DESC, total_time_ms ASC, finished_at ASC)
    rank_col = func.rank().over(
        order_by=[
            Attempt.score.desc(),
            func.coalesce(Attempt.total_time_ms, 9_999_999_999).asc(),
            func.coalesce(Attempt.finished_at, func.now()).asc(),
        ]
    ).label("rank")

    subq = (
        select(
            Attempt.participant_id.label("participant_id"),
            Attempt.score.label("score"),
            Attempt.total_time_ms.label("total_time_ms"),
            Attempt.finished_at.label("finished_at"),
            rank_col,
        )
        .where(
            Attempt.quiz_id == quiz_id,
            Attempt.status.in_([AttemptStatus.finished, AttemptStatus.forced_finished]),
        )
        .subquery()
    )
    return subq


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@router.get("/quizzes/active", response_model=ActiveQuizResponse)
async def get_active_quiz(db: AsyncSession = Depends(get_db)) -> ActiveQuizResponse:
    now = utcnow()
    quiz = await _pick_quiz(db)
    state, quiz2 = _quiz_state(quiz, now)
    quiz_dto = QuizDto.model_validate(quiz2, from_attributes=True) if quiz2 is not None else None
    return ActiveQuizResponse(state=state, now=now, quiz=quiz_dto)


@router.post("/participants/register", response_model=ParticipantRegisterResponse)
async def register_participant(
    payload: ParticipantRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> ParticipantRegisterResponse:
    try:
        fio_norm = normalize_nickname(payload.nickname)
        vk_norm = normalize_vk_url(payload.vk_url)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # если группы больше нет — фиксируем пустую строку (чтобы NOT NULL не падал)
    group_raw = ""
    group_norm = ""

    # do not "login" existing participant by nickname:
    # nickname collision should return conflict, otherwise someone can hijack another user's session
    res = await db.execute(
        select(Participant).where(and_(Participant.fio_norm == fio_norm, Participant.group_norm == group_norm))
    )
    p = res.scalar_one_or_none()

    if p is not None:
        raise HTTPException(status_code=409, detail="nickname_already_taken")

    p = Participant(
        fio_raw=payload.nickname,
        fio_norm=fio_norm,
        group_raw=group_raw,
        group_norm=group_norm,
        vk_url_raw=payload.vk_url,
        vk_url_norm=vk_norm,
    )
    db.add(p)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # race: nickname was created concurrently
        raise HTTPException(status_code=409, detail="nickname_already_taken")

    token = create_participant_token(p.id)
    response.set_cookie(key=COOKIE_NAME, value=token, **cookie_params())
    return ParticipantRegisterResponse(participant_id=p.id)


@router.post("/attempts/start", response_model=AttemptStartResponse)
async def start_attempt(
    response: Response,
    participant_id: int = Depends(_participant_id_dep),
    db: AsyncSession = Depends(get_db),
) -> AttemptStartResponse:
    now = utcnow()
    quiz = await _pick_quiz(db)
    state, _ = _quiz_state(quiz, now)
    if quiz is None or state != "running":
        raise HTTPException(status_code=409, detail={"state": state})

    # попытка только одна: UNIQUE(quiz_id, participant_id)
    attempt = await _get_attempt_for_update(db, quiz.id, participant_id)
    if attempt is None:
        attempt = Attempt(
            quiz_id=quiz.id,
            participant_id=participant_id,
            status=AttemptStatus.in_progress,
            started_at=now,
            current_question_order=1,
            current_question_started_at=now,
            score=0,
        )
        db.add(attempt)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            attempt = await _get_attempt_for_update(db, quiz.id, participant_id)

    if attempt.status in (AttemptStatus.finished, AttemptStatus.forced_finished):
        return AttemptStartResponse(status=attempt.status.value)

    if attempt.status == AttemptStatus.registered:
        attempt.status = AttemptStatus.in_progress
        attempt.started_at = now
        attempt.current_question_order = 1
        attempt.current_question_started_at = now
        await db.commit()

    return AttemptStartResponse(status=attempt.status.value)


@router.get("/questions/current", response_model=CurrentQuestionResponse)
async def get_current_question(
    participant_id: int = Depends(_participant_id_dep),
    db: AsyncSession = Depends(get_db),
) -> CurrentQuestionResponse:
    now = utcnow()
    quiz = await _pick_quiz(db)
    if quiz is None:
        raise HTTPException(status_code=404, detail="quiz_not_found")

    total = await _count_questions(db, quiz.id)

    attempt = await _get_attempt_for_update(db, quiz.id, participant_id)
    if attempt is None:
        return CurrentQuestionResponse(
            attempt_status=AttemptStatus.registered.value,
            question=None,
            time_left_seconds=None,
            progress={"current": 0, "total": total},
        )

    if attempt.status == AttemptStatus.in_progress:
        await advance_if_expired(db, quiz, attempt)
        await db.commit()

    # если квиз закончился — принудительно завершаем при обращении
    if attempt.status == AttemptStatus.in_progress:
        await force_finish_if_quiz_ended(db, quiz, attempt)
        await db.commit()

    if attempt.status in (AttemptStatus.finished, AttemptStatus.forced_finished):
        return CurrentQuestionResponse(
            attempt_status=attempt.status.value,
            question=None,
            time_left_seconds=None,
            progress={"current": total, "total": total},
        )

    qres = await db.execute(
        select(Question)
        .where(and_(Question.quiz_id == quiz.id, Question.order == attempt.current_question_order))
        .options(selectinload(Question.options), selectinload(Question.media))
    )
    q = qres.scalar_one_or_none()
    if q is None:
        # нет вопросов дальше — финиш
        _finish_attempt(attempt, now)
        await db.commit()
        return CurrentQuestionResponse(
            attempt_status=attempt.status.value,
            question=None,
            time_left_seconds=None,
            progress={"current": total, "total": total},
        )

    return CurrentQuestionResponse(
        attempt_status=attempt.status.value,
        question=_public_question_dto(q),
        time_left_seconds=_time_left_seconds(attempt, q),
        progress={"current": q.order, "total": total},
    )


@router.post("/questions/current/answer", response_model=AnswerCurrentQuestionResponse)
async def answer_current_question(
    payload: AnswerCurrentQuestionRequest,
    participant_id: int = Depends(_participant_id_dep),
    db: AsyncSession = Depends(get_db),
) -> AnswerCurrentQuestionResponse:
    now = utcnow()
    quiz = await _pick_quiz(db)
    if quiz is None:
        raise HTTPException(status_code=404, detail="quiz_not_found")

    attempt = await _get_attempt_for_update(db, quiz.id, participant_id)
    if attempt is None:
        raise HTTPException(status_code=409, detail="attempt_not_started")

    if attempt.status != AttemptStatus.in_progress:
        raise HTTPException(status_code=409, detail={"status": attempt.status.value})

    await advance_if_expired(db, quiz, attempt)
    if attempt.status != AttemptStatus.in_progress:
        await db.commit()
        raise HTTPException(status_code=409, detail={"status": attempt.status.value})

    # load current question
    qres = await db.execute(
        select(Question)
        .where(and_(Question.quiz_id == quiz.id, Question.order == attempt.current_question_order))
        .options(selectinload(Question.options), selectinload(Question.media), selectinload(Question.text_rules))
    )
    q = qres.scalar_one_or_none()
    if q is None:
        _finish_attempt(attempt, now)
        await db.commit()
        return AnswerCurrentQuestionResponse()

    if payload.question_id != q.id:
        await db.commit()
        raise HTTPException(status_code=409, detail="outdated_question")

    # prevent double-answer
    existing = (
        await db.execute(
            select(AttemptAnswer).where(and_(AttemptAnswer.attempt_id == attempt.id, AttemptAnswer.question_id == q.id))
        )
    ).scalar_one_or_none()
    if existing is not None:
        await db.commit()
        raise HTTPException(status_code=409, detail="already_answered")

    started_at = attempt.current_question_started_at or attempt.started_at or now

    now_u = ensure_utc(now)
    started_u = ensure_utc(started_at)

    time_spent_ms = int(max(0, (now_u - started_u).total_seconds() * 1000))

    payload_dict: dict[str, Any] = {
        "option_ids": payload.option_ids or [],
        "text": payload.text,
    }

    # scoring
    rules: list[TextAnswerRule] = list(q.text_rules or [])
    is_correct, awarded_points = scoring.score_answer(q, rules, payload_dict)

    db.add(
        AttemptAnswer(
            attempt_id=attempt.id,
            question_id=q.id,
            submitted_at=now,
            answer_json=payload_dict,
            is_correct=is_correct,
            awarded_points=awarded_points,
            auto_submitted=False,
            time_spent_ms=time_spent_ms,
        )
    )

    attempt.score = (attempt.score or 0) + int(awarded_points)
    attempt.current_question_order += 1
    attempt.current_question_started_at = now

    # finish if last question
    next_exists = (
        await db.execute(
            select(func.count())
            .select_from(Question)
            .where(and_(Question.quiz_id == quiz.id, Question.order == attempt.current_question_order))
        )
    ).scalar_one()
    if int(next_exists) == 0:
        _finish_attempt(attempt, now)

    # forced finish by end_at
    await force_finish_if_quiz_ended(db, quiz, attempt)

    await db.commit()
    return AnswerCurrentQuestionResponse()


@router.post("/questions/current/skip")
async def skip_current_question(
    payload: dict[str, Any],
    participant_id: int = Depends(_participant_id_dep),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # payload = {question_id: int}
    question_id = payload.get("question_id")
    if not isinstance(question_id, int):
        raise HTTPException(status_code=422, detail="question_id required")

    now = utcnow()
    quiz = await _pick_quiz(db)
    if quiz is None:
        raise HTTPException(status_code=404, detail="quiz_not_found")

    attempt = await _get_attempt_for_update(db, quiz.id, participant_id)
    if attempt is None:
        raise HTTPException(status_code=409, detail="attempt_not_started")

    if attempt.status != AttemptStatus.in_progress:
        raise HTTPException(status_code=409, detail={"status": attempt.status.value})

    await advance_if_expired(db, quiz, attempt)
    if attempt.status != AttemptStatus.in_progress:
        await db.commit()
        raise HTTPException(status_code=409, detail={"status": attempt.status.value})

    qres = await db.execute(
        select(Question)
        .where(and_(Question.quiz_id == quiz.id, Question.order == attempt.current_question_order))
        .options(selectinload(Question.options), selectinload(Question.media))
    )
    q = qres.scalar_one_or_none()
    if q is None:
        _finish_attempt(attempt, now)
        await db.commit()
        return {"ok": True}

    if question_id != q.id:
        await db.commit()
        raise HTTPException(status_code=409, detail="outdated_question")

    existing = (
        await db.execute(
            select(AttemptAnswer).where(and_(AttemptAnswer.attempt_id == attempt.id, AttemptAnswer.question_id == q.id))
        )
    ).scalar_one_or_none()
    if existing is None:
        started_at = attempt.current_question_started_at or attempt.started_at or now

        now_u = ensure_utc(now)
        started_u = ensure_utc(started_at)

        time_spent_ms = int(max(0, (now_u - started_u).total_seconds() * 1000))
        db.add(
            AttemptAnswer(
                attempt_id=attempt.id,
                question_id=q.id,
                submitted_at=now,
                answer_json={"skipped": True},
                is_correct=False,
                awarded_points=0,
                auto_submitted=False,
                time_spent_ms=time_spent_ms,
            )
        )

    attempt.current_question_order += 1
    attempt.current_question_started_at = now

    next_exists = (
        await db.execute(
            select(func.count())
            .select_from(Question)
            .where(and_(Question.quiz_id == quiz.id, Question.order == attempt.current_question_order))
        )
    ).scalar_one()
    if int(next_exists) == 0:
        _finish_attempt(attempt, now)

    await force_finish_if_quiz_ended(db, quiz, attempt)
    await db.commit()
    return {"ok": True}


@router.get("/result", response_model=ResultResponse)
async def get_result(
    participant_id: int = Depends(_participant_id_dep),
    db: AsyncSession = Depends(get_db),
) -> ResultResponse:
    now = utcnow()
    quiz = await _pick_quiz(db)
    if quiz is None:
        raise HTTPException(status_code=404, detail="quiz_not_found")

    attempt = await _get_attempt_for_update(db, quiz.id, participant_id)
    if attempt is None:
        total = await _count_questions(db, quiz.id)
        return ResultResponse(status=AttemptStatus.registered.value, score=0, place=None, total_time_ms=None)

    if attempt.status == AttemptStatus.in_progress:
        await advance_if_expired(db, quiz, attempt)
        await force_finish_if_quiz_ended(db, quiz, attempt)
        await db.commit()

    place = None
    if attempt.status in (AttemptStatus.finished, AttemptStatus.forced_finished):
        subq = await _leaderboard_subq(db, quiz.id)
        res = await db.execute(select(subq.c.rank).where(subq.c.participant_id == participant_id))
        place = res.scalar_one_or_none()

    return ResultResponse(
        status=attempt.status.value,
        score=int(attempt.score or 0),
        place=int(place) if place is not None else None,
        total_time_ms=attempt.total_time_ms,
    )


def _optional_participant_id(token: str | None = Cookie(default=None, alias=COOKIE_NAME)) -> int | None:
    if token is None:
        return None
    return get_participant_id_from_cookie(token)


@router.get("/me")
async def me(
    participant_id: int | None = Depends(_optional_participant_id),
    admin_token: str | None = Cookie(default=None, alias="admin_token"),
) -> dict:
    # Роль нужна фронту для показа пункта меню "Админ" только администратору.
    # Участнику роль возвращается только если есть participant cookie.
    from app.services.auth import get_admin_from_cookie

    if get_admin_from_cookie(admin_token):
        return {"role": "admin", "display_name": None}
    if participant_id is not None:
        return {"role": "participant", "display_name": None}
    return {"role": "anonymous", "display_name": None}


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def leaderboard(
    limit: int = 20,
    participant_id: int | None = Depends(_optional_participant_id),
    db: AsyncSession = Depends(get_db),
) -> LeaderboardResponse:
    quiz = await _pick_quiz(db)
    if quiz is None:
        return LeaderboardResponse(top=[], me=None, me_status="not_started")

    limit = max(1, min(100, int(limit)))

    subq = await _leaderboard_subq(db, quiz.id)

    # top
    res = await db.execute(
        select(
            subq.c.rank,
            subq.c.participant_id,
            subq.c.score,
            func.coalesce(subq.c.total_time_ms, 0).label("total_time_ms"),
            Participant.fio_norm,
        )
        .join(Participant, Participant.id == subq.c.participant_id)
        .order_by(subq.c.rank.asc())
        .limit(limit)
    )

    top_rows: list[LeaderboardRow] = []
    for rank, pid, score_, total_ms, fio_norm in res.all():
        top_rows.append(
            LeaderboardRow(
                rank=int(rank),
                display_name=fio_to_display(str(fio_norm)),
                score=int(score_),
                total_time_ms=int(total_ms),
            )
        )

    # me
    me = None
    me_status: str = "not_started"

    if participant_id is not None:
        ares = await db.execute(
            select(Attempt).where(and_(Attempt.quiz_id == quiz.id, Attempt.participant_id == participant_id))
        )
        attempt = ares.scalar_one_or_none()
        if attempt is None:
            me_status = "not_started"
        else:
            me_status = attempt.status.value

        if attempt is not None and attempt.status in (AttemptStatus.finished, AttemptStatus.forced_finished):
            mres = await db.execute(
                select(
                    subq.c.rank,
                    subq.c.score,
                    func.coalesce(subq.c.total_time_ms, 0).label("total_time_ms"),
                    Participant.fio_norm,
                )
                .join(Participant, Participant.id == subq.c.participant_id)
                .where(subq.c.participant_id == participant_id)
            )
            row = mres.first()
            if row:
                me = LeaderboardRow(
                    rank=int(row.rank),
                    display_name=fio_to_display(str(row.fio_norm)),
                    score=int(row.score),
                    total_time_ms=int(row.total_time_ms),
                )

    return LeaderboardResponse(top=top_rows, me=me, me_status=me_status)

