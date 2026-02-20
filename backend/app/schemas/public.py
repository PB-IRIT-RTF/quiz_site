from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


QuizState = Literal["running", "ended", "not_started", "unpublished", "none"]
AttemptStatus = Literal["registered", "in_progress", "finished", "forced_finished"]
QuestionType = Literal["single", "multi", "text"]

MediaKind = Literal["image", "audio", "video", "embed"]
MediaSourceType = Literal["upload", "url"]


class HealthResponse(BaseModel):
    ok: Literal[True] = True


class QuizDto(BaseModel):
    id: int
    title: str
    start_at: datetime
    end_at: datetime
    published: bool


class ActiveQuizResponse(BaseModel):
    state: QuizState
    now: datetime
    quiz: QuizDto | None


class ParticipantRegisterRequest(BaseModel):
    fio: str
    group: str
    vk_url: str


class ParticipantRegisterResponse(BaseModel):
    participant_id: int


class AttemptStartResponse(BaseModel):
    status: AttemptStatus


class OptionPublicDto(BaseModel):
    id: int
    text: str


class QuestionMediaDto(BaseModel):
    id: int
    kind: MediaKind
    source_type: MediaSourceType
    url: str
    mime: str | None = None
    title: str | None = None
    sort_order: int


class QuestionPublicDto(BaseModel):
    id: int
    order: int
    type: QuestionType
    text: str
    points: int
    time_limit_seconds: int | None
    options: list[OptionPublicDto] | None = None
    media: list[QuestionMediaDto] = Field(default_factory=list)


class CurrentQuestionResponse(BaseModel):
    attempt_status: AttemptStatus
    question: QuestionPublicDto | None
    time_left_seconds: int | None
    progress: dict[str, int]


class AnswerCurrentQuestionRequest(BaseModel):
    question_id: int
    type: QuestionType
    option_ids: list[int] | None = None
    text: str | None = None


class AnswerCurrentQuestionResponse(BaseModel):
    ok: Literal[True] = True


class SkipCurrentQuestionRequest(BaseModel):
    question_id: int


class ResultResponse(BaseModel):
    status: AttemptStatus
    score: int
    place: int | None
    total_time_ms: int | None


class LeaderboardRow(BaseModel):
    rank: int
    display_name: str
    score: int
    total_time_ms: int


class LeaderboardResponse(BaseModel):
    top: list[LeaderboardRow]
    me: LeaderboardRow | None
    me_status: AttemptStatus | Literal["not_started"]


class AdminLoginRequest(BaseModel):
    password: str


class AdminLoginResponse(BaseModel):
    ok: Literal[True] = True


class StatsSummaryResponse(BaseModel):
    registered: int
    started: int
    in_progress: int
    finished: int
    forced_finished: int
