from __future__ import annotations

from datetime import datetime
from io import StringIO
import csv
from collections import deque
from time import monotonic

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.enums import AttemptStatus, MediaKind, MediaSourceType, QuestionType, TextMatchType
from app.models.models import (
    AdminUser,
    Attempt,
    AttemptAnswer,
    Option,
    Participant,
    Question,
    QuestionMedia,
    Quiz,
    TextAnswerRule,
)
from app.core.config import settings
from app.services.auth import (
    ADMIN_COOKIE_NAME,
    ADMIN_CSRF_COOKIE_NAME,
    cookie_params,
    create_admin_token,
    create_csrf_token,
    csrf_cookie_params,
    get_admin_from_cookie,
)
from app.services.media import validate_media_url
from app.services.security import verify_password


router = APIRouter(prefix="/admin")
_LOGIN_ATTEMPTS: dict[str, deque[float]] = {}
_LOGIN_BLOCKED_UNTIL: dict[str, float] = {}


# ------------------------
# Auth guard
# ------------------------
def require_admin(
    request: Request,
    admin_token: str | None = Cookie(default=None, alias=ADMIN_COOKIE_NAME),
    admin_csrf: str | None = Cookie(default=None, alias=ADMIN_CSRF_COOKIE_NAME),
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> None:
    if not get_admin_from_cookie(admin_token):
        raise HTTPException(status_code=403, detail="admin_required")
    if request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
        if not admin_csrf or not x_csrf_token or admin_csrf != x_csrf_token:
            raise HTTPException(status_code=403, detail="csrf_invalid")


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def _rate_limit_check(request: Request) -> None:
    ip = _client_ip(request)
    now = monotonic()
    blocked_until = _LOGIN_BLOCKED_UNTIL.get(ip, 0.0)
    if blocked_until > now:
        retry_after = int(max(1, blocked_until - now))
        raise HTTPException(status_code=429, detail=f"too_many_attempts_retry_in_{retry_after}s")

    window = max(1, int(settings.admin_login_rate_limit_window_seconds))
    limit = max(1, int(settings.admin_login_rate_limit_max_attempts))
    attempts = _LOGIN_ATTEMPTS.setdefault(ip, deque())

    window_start = now - window
    while attempts and attempts[0] < window_start:
        attempts.popleft()

    if len(attempts) >= limit:
        block_for = max(1, int(settings.admin_login_rate_limit_block_seconds))
        _LOGIN_BLOCKED_UNTIL[ip] = now + block_for
        attempts.clear()
        raise HTTPException(status_code=429, detail=f"too_many_attempts_retry_in_{block_for}s")


def _record_login_failure(request: Request) -> None:
    ip = _client_ip(request)
    now = monotonic()
    attempts = _LOGIN_ATTEMPTS.setdefault(ip, deque())
    attempts.append(now)


def _clear_login_failures(request: Request) -> None:
    ip = _client_ip(request)
    _LOGIN_ATTEMPTS.pop(ip, None)
    _LOGIN_BLOCKED_UNTIL.pop(ip, None)


# ------------------------
# Login/logout/stats (оставляем)
# ------------------------
class AdminLoginRequest(BaseModel):
    password: str


class AdminLoginResponse(BaseModel):
    ok: bool = True


class StatsSummaryResponse(BaseModel):
    registered: int
    started: int
    in_progress: int
    finished: int
    forced_finished: int


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(
    payload: AdminLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AdminLoginResponse:
    _rate_limit_check(request)
    user = (
        await db.execute(select(AdminUser).where(AdminUser.username == "admin", AdminUser.is_active.is_(True)))
    ).scalar_one_or_none()
    if user is None:
        _record_login_failure(request)
        raise HTTPException(status_code=403, detail="admin_not_configured")

    if not verify_password(payload.password, user.password_hash):
        _record_login_failure(request)
        raise HTTPException(status_code=403, detail="bad_password")

    _clear_login_failures(request)
    token = create_admin_token()
    csrf = create_csrf_token()
    response.set_cookie(key=ADMIN_COOKIE_NAME, value=token, **cookie_params())
    response.set_cookie(key=ADMIN_CSRF_COOKIE_NAME, value=csrf, **csrf_cookie_params())
    return AdminLoginResponse()


@router.post("/logout")
async def admin_logout(response: Response) -> dict:
    response.delete_cookie(key=ADMIN_COOKIE_NAME, path="/")
    response.delete_cookie(key=ADMIN_CSRF_COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/stats/summary", response_model=StatsSummaryResponse, dependencies=[Depends(require_admin)])
async def stats_summary(db: AsyncSession = Depends(get_db)) -> StatsSummaryResponse:
    registered = int((await db.execute(select(func.count()).select_from(Participant))).scalar_one())

    async def count_attempts(*conds):
        q = select(func.count()).select_from(Attempt)
        for c in conds:
            q = q.where(c)
        return int((await db.execute(q)).scalar_one())

    in_progress = await count_attempts(Attempt.status == AttemptStatus.in_progress)
    finished = await count_attempts(Attempt.status == AttemptStatus.finished)
    forced_finished = await count_attempts(Attempt.status == AttemptStatus.forced_finished)
    started = in_progress + finished + forced_finished

    return StatsSummaryResponse(
        registered=registered,
        started=started,
        in_progress=in_progress,
        finished=finished,
        forced_finished=forced_finished,
    )


# ------------------------
# Schemas для CRUD
# ------------------------
class QuizAdminDto(BaseModel):
    id: int
    title: str
    start_at: datetime
    end_at: datetime
    published: bool
    created_at: datetime

    @classmethod
    def from_orm(cls, q: Quiz) -> "QuizAdminDto":
        return cls(
            id=q.id,
            title=q.title,
            start_at=q.start_at,
            end_at=q.end_at,
            published=bool(q.published),
            created_at=q.created_at,
        )


class QuizCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    start_at: datetime
    end_at: datetime
    published: bool = False


class QuizUpdateRequest(BaseModel):
    title: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    published: bool | None = None


class QuestionAdminDto(BaseModel):
    id: int
    quiz_id: int
    order: int
    type: QuestionType
    text: str
    points: int
    time_limit_seconds: int | None

    options: list[dict] = []
    text_rules: list[dict] = []
    media: list[dict] = []

    @classmethod
    def from_orm(cls, q: Question) -> "QuestionAdminDto":
        return cls(
            id=q.id,
            quiz_id=q.quiz_id,
            order=q.order,
            type=q.type,
            text=q.text,
            points=int(q.points),
            time_limit_seconds=q.time_limit_seconds,
            options=[{"id": o.id, "text": o.text, "is_correct": bool(o.is_correct)} for o in (q.options or [])],
            text_rules=[
                {"id": r.id, "match_type": r.match_type, "pattern": r.pattern, "sort_order": int(r.sort_order)}
                for r in (q.text_rules or [])
            ],
            media=[
                {
                    "id": m.id,
                    "kind": m.kind,
                    "source_type": m.source_type,
                    "url": m.url,
                    "mime": m.mime,
                    "title": m.title,
                    "sort_order": int(m.sort_order),
                }
                for m in (q.media or [])
            ],
        )


class QuestionCreateRequest(BaseModel):
    order: int
    type: QuestionType
    text: str = Field(..., min_length=1)
    points: int = 1
    time_limit_seconds: int | None = None


class QuestionUpdateRequest(BaseModel):
    order: int | None = None
    type: QuestionType | None = None
    text: str | None = None
    points: int | None = None
    time_limit_seconds: int | None = None


class ReorderQuestionsRequest(BaseModel):
    ordered_question_ids: list[int]


class OptionCreateRequest(BaseModel):
    text: str = Field(..., min_length=1)
    is_correct: bool = False


class OptionUpdateRequest(BaseModel):
    text: str | None = None
    is_correct: bool | None = None


class TextRuleCreateRequest(BaseModel):
    match_type: TextMatchType
    pattern: str = Field(..., min_length=1)
    sort_order: int = 1


class TextRuleUpdateRequest(BaseModel):
    match_type: TextMatchType | None = None
    pattern: str | None = None
    sort_order: int | None = None


class MediaCreateRequest(BaseModel):
    kind: MediaKind
    source_type: MediaSourceType = MediaSourceType.url
    url: str = Field(..., min_length=1)
    mime: str | None = None
    title: str | None = None
    sort_order: int = 1


class MediaUpdateRequest(BaseModel):
    kind: MediaKind | None = None
    source_type: MediaSourceType | None = None
    url: str | None = None
    mime: str | None = None
    title: str | None = None
    sort_order: int | None = None


class AttemptRowDto(BaseModel):
    id: int
    participant_id: int
    fio_norm: str
    vk_url_norm: str | None = None
    status: AttemptStatus
    score: int
    total_time_ms: int | None
    started_at: datetime | None
    finished_at: datetime | None


class AttemptAnswerDto(BaseModel):
    id: int
    question_id: int
    submitted_at: datetime
    answer_json: dict
    is_correct: bool
    awarded_points: int
    auto_submitted: bool
    time_spent_ms: int


# ------------------------
# Helpers
# ------------------------
async def _get_quiz(db: AsyncSession, quiz_id: int) -> Quiz:
    q = (await db.execute(select(Quiz).where(Quiz.id == quiz_id))).scalar_one_or_none()
    if q is None:
        raise HTTPException(status_code=404, detail="quiz_not_found")
    return q


async def _get_question(db: AsyncSession, question_id: int) -> Question:
    q = (
        await db.execute(
            select(Question)
            .where(Question.id == question_id)
            .options(selectinload(Question.options), selectinload(Question.text_rules), selectinload(Question.media))
        )
    ).scalar_one_or_none()
    if q is None:
        raise HTTPException(status_code=404, detail="question_not_found")
    return q


# ------------------------
# Quizzes CRUD
# ------------------------
@router.get("/quizzes", response_model=list[QuizAdminDto], dependencies=[Depends(require_admin)])
async def list_quizzes(db: AsyncSession = Depends(get_db)) -> list[QuizAdminDto]:
    res = await db.execute(select(Quiz).order_by(Quiz.created_at.desc()))
    return [QuizAdminDto.from_orm(q) for q in res.scalars().all()]


@router.post("/quizzes", response_model=QuizAdminDto, dependencies=[Depends(require_admin)])
async def create_quiz(payload: QuizCreateRequest, db: AsyncSession = Depends(get_db)) -> QuizAdminDto:
    if payload.end_at <= payload.start_at:
        raise HTTPException(status_code=422, detail="end_at_must_be_after_start_at")
    q = Quiz(
        title=payload.title,
        start_at=payload.start_at,
        end_at=payload.end_at,
        published=bool(payload.published),
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return QuizAdminDto.from_orm(q)


@router.get("/quizzes/{quiz_id}", response_model=QuizAdminDto, dependencies=[Depends(require_admin)])
async def get_quiz(quiz_id: int, db: AsyncSession = Depends(get_db)) -> QuizAdminDto:
    q = await _get_quiz(db, quiz_id)
    return QuizAdminDto.from_orm(q)


@router.patch("/quizzes/{quiz_id}", response_model=QuizAdminDto, dependencies=[Depends(require_admin)])
async def update_quiz(quiz_id: int, payload: QuizUpdateRequest, db: AsyncSession = Depends(get_db)) -> QuizAdminDto:
    q = await _get_quiz(db, quiz_id)
    if payload.title is not None:
        q.title = payload.title
    if payload.start_at is not None:
        q.start_at = payload.start_at
    if payload.end_at is not None:
        q.end_at = payload.end_at
    if payload.published is not None:
        q.published = bool(payload.published)

    if q.end_at <= q.start_at:
        raise HTTPException(status_code=422, detail="end_at_must_be_after_start_at")

    await db.commit()
    await db.refresh(q)
    return QuizAdminDto.from_orm(q)


@router.delete("/quizzes/{quiz_id}", dependencies=[Depends(require_admin)])
async def delete_quiz(quiz_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    q = await _get_quiz(db, quiz_id)
    await db.delete(q)
    await db.commit()
    return {"ok": True}


@router.post("/quizzes/{quiz_id}/publish", response_model=QuizAdminDto, dependencies=[Depends(require_admin)])
async def publish_quiz(quiz_id: int, db: AsyncSession = Depends(get_db)) -> QuizAdminDto:
    q = await _get_quiz(db, quiz_id)
    q.published = True
    await db.commit()
    await db.refresh(q)
    return QuizAdminDto.from_orm(q)


@router.post("/quizzes/{quiz_id}/unpublish", response_model=QuizAdminDto, dependencies=[Depends(require_admin)])
async def unpublish_quiz(quiz_id: int, db: AsyncSession = Depends(get_db)) -> QuizAdminDto:
    q = await _get_quiz(db, quiz_id)
    q.published = False
    await db.commit()
    await db.refresh(q)
    return QuizAdminDto.from_orm(q)


# ------------------------
# Questions CRUD
# ------------------------
@router.get("/quizzes/{quiz_id}/questions", response_model=list[QuestionAdminDto], dependencies=[Depends(require_admin)])
async def list_questions(quiz_id: int, db: AsyncSession = Depends(get_db)) -> list[QuestionAdminDto]:
    await _get_quiz(db, quiz_id)
    res = await db.execute(
        select(Question)
        .where(Question.quiz_id == quiz_id)
        .order_by(Question.order.asc())
        .options(selectinload(Question.options), selectinload(Question.text_rules), selectinload(Question.media))
    )
    return [QuestionAdminDto.from_orm(q) for q in res.scalars().all()]


@router.post("/quizzes/{quiz_id}/questions", response_model=QuestionAdminDto, dependencies=[Depends(require_admin)])
async def create_question(quiz_id: int, payload: QuestionCreateRequest, db: AsyncSession = Depends(get_db)) -> QuestionAdminDto:
    await _get_quiz(db, quiz_id)

    q = Question(
        quiz_id=quiz_id,
        order=int(payload.order),
        type=payload.type,
        text=payload.text,
        points=int(payload.points),
        time_limit_seconds=payload.time_limit_seconds,
    )
    db.add(q)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="question_order_conflict")

    q2 = await _get_question(db, q.id)
    return QuestionAdminDto.from_orm(q2)


@router.patch("/questions/{question_id}", response_model=QuestionAdminDto, dependencies=[Depends(require_admin)])
async def update_question(question_id: int, payload: QuestionUpdateRequest, db: AsyncSession = Depends(get_db)) -> QuestionAdminDto:
    q = await _get_question(db, question_id)

    if payload.order is not None:
        q.order = int(payload.order)
    if payload.type is not None:
        q.type = payload.type
    if payload.text is not None:
        q.text = payload.text
    if payload.points is not None:
        q.points = int(payload.points)
    if payload.time_limit_seconds is not None or payload.time_limit_seconds is None:
        # allow explicit null
        q.time_limit_seconds = payload.time_limit_seconds

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="question_order_conflict")

    q2 = await _get_question(db, question_id)
    return QuestionAdminDto.from_orm(q2)


@router.delete("/questions/{question_id}", dependencies=[Depends(require_admin)])
async def delete_question(question_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    q = await _get_question(db, question_id)
    await db.delete(q)
    await db.commit()
    return {"ok": True}


@router.post("/quizzes/{quiz_id}/questions/reorder", dependencies=[Depends(require_admin)])
async def reorder_questions(quiz_id: int, payload: ReorderQuestionsRequest, db: AsyncSession = Depends(get_db)) -> dict:
    await _get_quiz(db, quiz_id)
    ids = [int(x) for x in payload.ordered_question_ids]

    # load questions ensure belong to quiz
    res = await db.execute(select(Question).where(and_(Question.quiz_id == quiz_id, Question.id.in_(ids))))
    items = {q.id: q for q in res.scalars().all()}
    if len(items) != len(ids):
        raise HTTPException(status_code=422, detail="some_questions_not_found")

    # Two-phase reorder to avoid temporary unique(order) collisions:
    # 1) move all involved rows to a temporary high range
    # 2) assign final 1..N order
    temp_base = 1_000_000
    for idx, qid in enumerate(ids, start=1):
        items[qid].order = temp_base + idx

    try:
        await db.flush()
        for idx, qid in enumerate(ids, start=1):
            items[qid].order = idx
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="question_order_conflict")

    return {"ok": True}


# ------------------------
# Options CRUD
# ------------------------
@router.post("/questions/{question_id}/options", response_model=QuestionAdminDto, dependencies=[Depends(require_admin)])
async def add_option(question_id: int, payload: OptionCreateRequest, db: AsyncSession = Depends(get_db)) -> QuestionAdminDto:
    q = await _get_question(db, question_id)
    if q.type not in (QuestionType.single, QuestionType.multi):
        raise HTTPException(status_code=409, detail="options_not_allowed_for_type")

    db.add(Option(question_id=question_id, text=payload.text, is_correct=bool(payload.is_correct)))
    await db.commit()
    q2 = await _get_question(db, question_id)
    return QuestionAdminDto.from_orm(q2)


@router.patch("/options/{option_id}", response_model=QuestionAdminDto, dependencies=[Depends(require_admin)])
async def update_option(option_id: int, payload: OptionUpdateRequest, db: AsyncSession = Depends(get_db)) -> QuestionAdminDto:
    opt = (await db.execute(select(Option).where(Option.id == option_id))).scalar_one_or_none()
    if opt is None:
        raise HTTPException(status_code=404, detail="option_not_found")

    if payload.text is not None:
        opt.text = payload.text
    if payload.is_correct is not None:
        opt.is_correct = bool(payload.is_correct)

    await db.commit()
    q2 = await _get_question(db, opt.question_id)
    return QuestionAdminDto.from_orm(q2)


@router.delete("/options/{option_id}", response_model=QuestionAdminDto, dependencies=[Depends(require_admin)])
async def delete_option(option_id: int, db: AsyncSession = Depends(get_db)) -> QuestionAdminDto:
    opt = (await db.execute(select(Option).where(Option.id == option_id))).scalar_one_or_none()
    if opt is None:
        raise HTTPException(status_code=404, detail="option_not_found")

    qid = opt.question_id
    await db.delete(opt)
    await db.commit()
    q2 = await _get_question(db, qid)
    return QuestionAdminDto.from_orm(q2)


# ------------------------
# Text rules CRUD
# ------------------------
@router.post("/questions/{question_id}/text-rules", response_model=QuestionAdminDto, dependencies=[Depends(require_admin)])
async def add_text_rule(question_id: int, payload: TextRuleCreateRequest, db: AsyncSession = Depends(get_db)) -> QuestionAdminDto:
    q = await _get_question(db, question_id)
    if q.type != QuestionType.text:
        raise HTTPException(status_code=409, detail="text_rules_not_allowed_for_type")

    db.add(
        TextAnswerRule(
            question_id=question_id,
            match_type=payload.match_type,
            pattern=payload.pattern,
            sort_order=int(payload.sort_order),
        )
    )
    await db.commit()
    q2 = await _get_question(db, question_id)
    return QuestionAdminDto.from_orm(q2)


@router.patch("/text-rules/{rule_id}", response_model=QuestionAdminDto, dependencies=[Depends(require_admin)])
async def update_text_rule(rule_id: int, payload: TextRuleUpdateRequest, db: AsyncSession = Depends(get_db)) -> QuestionAdminDto:
    rule = (await db.execute(select(TextAnswerRule).where(TextAnswerRule.id == rule_id))).scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="text_rule_not_found")

    if payload.match_type is not None:
        rule.match_type = payload.match_type
    if payload.pattern is not None:
        rule.pattern = payload.pattern
    if payload.sort_order is not None:
        rule.sort_order = int(payload.sort_order)

    await db.commit()
    q2 = await _get_question(db, rule.question_id)
    return QuestionAdminDto.from_orm(q2)


@router.delete("/text-rules/{rule_id}", response_model=QuestionAdminDto, dependencies=[Depends(require_admin)])
async def delete_text_rule(rule_id: int, db: AsyncSession = Depends(get_db)) -> QuestionAdminDto:
    rule = (await db.execute(select(TextAnswerRule).where(TextAnswerRule.id == rule_id))).scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="text_rule_not_found")

    qid = rule.question_id
    await db.delete(rule)
    await db.commit()
    q2 = await _get_question(db, qid)
    return QuestionAdminDto.from_orm(q2)


# ------------------------
# Media CRUD
# ------------------------
@router.post("/questions/{question_id}/media", response_model=QuestionAdminDto, dependencies=[Depends(require_admin)])
async def add_media(question_id: int, payload: MediaCreateRequest, db: AsyncSession = Depends(get_db)) -> QuestionAdminDto:
    await _get_question(db, question_id)
    try:
        media_url = validate_media_url(payload.kind, payload.url)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    db.add(
        QuestionMedia(
            question_id=question_id,
            kind=payload.kind,
            source_type=payload.source_type,
            url=media_url,
            mime=payload.mime,
            title=payload.title,
            sort_order=int(payload.sort_order),
        )
    )
    await db.commit()
    q2 = await _get_question(db, question_id)
    return QuestionAdminDto.from_orm(q2)


@router.patch("/media/{media_id}", response_model=QuestionAdminDto, dependencies=[Depends(require_admin)])
async def update_media(media_id: int, payload: MediaUpdateRequest, db: AsyncSession = Depends(get_db)) -> QuestionAdminDto:
    m = (await db.execute(select(QuestionMedia).where(QuestionMedia.id == media_id))).scalar_one_or_none()
    if m is None:
        raise HTTPException(status_code=404, detail="media_not_found")

    next_kind = payload.kind if payload.kind is not None else m.kind
    next_url = payload.url if payload.url is not None else m.url
    try:
        validated_url = validate_media_url(next_kind, next_url)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if payload.kind is not None:
        m.kind = payload.kind
    if payload.source_type is not None:
        m.source_type = payload.source_type
    if payload.url is not None:
        m.url = validated_url
    if payload.mime is not None or payload.mime is None:
        m.mime = payload.mime
    if payload.title is not None or payload.title is None:
        m.title = payload.title
    if payload.sort_order is not None:
        m.sort_order = int(payload.sort_order)

    await db.commit()
    q2 = await _get_question(db, m.question_id)
    return QuestionAdminDto.from_orm(q2)


@router.delete("/media/{media_id}", response_model=QuestionAdminDto, dependencies=[Depends(require_admin)])
async def delete_media(media_id: int, db: AsyncSession = Depends(get_db)) -> QuestionAdminDto:
    m = (await db.execute(select(QuestionMedia).where(QuestionMedia.id == media_id))).scalar_one_or_none()
    if m is None:
        raise HTTPException(status_code=404, detail="media_not_found")

    qid = m.question_id
    await db.delete(m)
    await db.commit()
    q2 = await _get_question(db, qid)
    return QuestionAdminDto.from_orm(q2)


# ------------------------
# Results / Attempts
# ------------------------
@router.get("/quizzes/{quiz_id}/attempts", response_model=list[AttemptRowDto], dependencies=[Depends(require_admin)])
async def list_attempts(
    quiz_id: int,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> list[AttemptRowDto]:
    await _get_quiz(db, quiz_id)
    limit = max(1, min(200, int(limit)))
    offset = max(0, int(offset))

    res = await db.execute(
        select(
            Attempt,
            Participant.fio_norm,
            Participant.vk_url_norm,
        )
        .join(Participant, Participant.id == Attempt.participant_id)
        .where(Attempt.quiz_id == quiz_id)
        .order_by(Attempt.score.desc(), func.coalesce(Attempt.total_time_ms, 9_999_999_999).asc())
        .limit(limit)
        .offset(offset)
    )

    rows: list[AttemptRowDto] = []
    for attempt, fio_norm, vk_url_norm in res.all():
        rows.append(
            AttemptRowDto(
                id=attempt.id,
                participant_id=attempt.participant_id,
                fio_norm=str(fio_norm),
                vk_url_norm=str(vk_url_norm) if vk_url_norm else None,
                status=attempt.status,
                score=int(attempt.score or 0),
                total_time_ms=attempt.total_time_ms,
                started_at=attempt.started_at,
                finished_at=attempt.finished_at,
            )
        )
    return rows


@router.get("/attempts/{attempt_id}/answers", response_model=list[AttemptAnswerDto], dependencies=[Depends(require_admin)])
async def get_attempt_answers(attempt_id: int, db: AsyncSession = Depends(get_db)) -> list[AttemptAnswerDto]:
    a = (await db.execute(select(Attempt).where(Attempt.id == attempt_id))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="attempt_not_found")

    res = await db.execute(
        select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt_id).order_by(AttemptAnswer.submitted_at.asc())
    )
    out: list[AttemptAnswerDto] = []
    for ans in res.scalars().all():
        out.append(
            AttemptAnswerDto(
                id=ans.id,
                question_id=ans.question_id,
                submitted_at=ans.submitted_at,
                answer_json=ans.answer_json,
                is_correct=bool(ans.is_correct),
                awarded_points=int(ans.awarded_points),
                auto_submitted=bool(ans.auto_submitted),
                time_spent_ms=int(ans.time_spent_ms),
            )
        )
    return out


@router.get("/quizzes/{quiz_id}/export.csv", dependencies=[Depends(require_admin)])
async def export_csv(quiz_id: int, db: AsyncSession = Depends(get_db)):
    await _get_quiz(db, quiz_id)

    res = await db.execute(
        select(
            Attempt.id,
            Attempt.participant_id,
            Participant.fio_norm,
            Participant.vk_url_norm,
            Attempt.status,
            Attempt.score,
            Attempt.total_time_ms,
            Attempt.started_at,
            Attempt.finished_at,
        )
        .join(Participant, Participant.id == Attempt.participant_id)
        .where(Attempt.quiz_id == quiz_id)
        .order_by(Attempt.score.desc(), func.coalesce(Attempt.total_time_ms, 9_999_999_999).asc())
    )

    def _csv_safe(val):
        s = str(val) if val is not None else ""
        if s and s[0] in {"=", "+", "-", "@", "\t"}:
            return "'" + s
        return s

    def iter_csv():
        buf = StringIO()
        w = csv.writer(buf)
        w.writerow(["attempt_id", "participant_id", "fio", "vk_url", "status", "score", "total_time_ms", "started_at", "finished_at"])
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)

        for row in res.all():
            w.writerow([_csv_safe(x) for x in row])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(iter_csv(), media_type="text/csv")
