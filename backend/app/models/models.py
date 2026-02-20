from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import AttemptStatus, MediaKind, MediaSourceType, QuestionType, TextMatchType


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    questions: Mapped[list[Question]] = relationship(back_populates="quiz", cascade="all, delete-orphan")


class Participant(Base):
    __tablename__ = "participants"
    __table_args__ = (UniqueConstraint("fio_norm", "group_norm", name="uq_participants_fio_group"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    fio_raw: Mapped[str] = mapped_column(Text, nullable=False)
    fio_norm: Mapped[str] = mapped_column(Text, nullable=False)
    group_raw: Mapped[str] = mapped_column(Text, nullable=False)
    group_norm: Mapped[str] = mapped_column(Text, nullable=False)
    vk_url_raw: Mapped[str] = mapped_column(Text, nullable=False)
    vk_url_norm: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AdminUser(Base):
    __tablename__ = "admin_users"
    __table_args__ = (UniqueConstraint("username", name="uq_admin_users_username"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Attempt(Base):
    __tablename__ = "attempts"
    __table_args__ = (UniqueConstraint("quiz_id", "participant_id", name="uq_attempt_quiz_participant"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    quiz_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    participant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("participants.id", ondelete="CASCADE"), nullable=False
    )

    status: Mapped[AttemptStatus] = mapped_column(Enum(AttemptStatus, name="attempt_status"), nullable=False)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_time_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    current_question_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_question_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (UniqueConstraint("quiz_id", "order", name="uq_questions_quiz_order"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    quiz_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[QuestionType] = mapped_column(Enum(QuestionType, name="question_type"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    time_limit_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    quiz: Mapped[Quiz] = relationship(back_populates="questions")
    options: Mapped[list[Option]] = relationship(back_populates="question", cascade="all, delete-orphan")
    text_rules: Mapped[list[TextAnswerRule]] = relationship(back_populates="question", cascade="all, delete-orphan")
    media: Mapped[list[QuestionMedia]] = relationship(back_populates="question", cascade="all, delete-orphan")


class Option(Base):
    __tablename__ = "options"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    question_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    question: Mapped[Question] = relationship(back_populates="options")


class TextAnswerRule(Base):
    __tablename__ = "text_answer_rules"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    question_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    match_type: Mapped[TextMatchType] = mapped_column(Enum(TextMatchType, name="text_match_type"), nullable=False)
    pattern: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    question: Mapped[Question] = relationship(back_populates="text_rules")


class QuestionMedia(Base):
    __tablename__ = "question_media"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    question_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )

    kind: Mapped[MediaKind] = mapped_column(Enum(MediaKind, name="media_kind"), nullable=False)
    source_type: Mapped[MediaSourceType] = mapped_column(
        Enum(MediaSourceType, name="media_source_type"), nullable=False
    )

    url: Mapped[str] = mapped_column(Text, nullable=False)
    mime: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    question: Mapped[Question] = relationship(back_populates="media")


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"
    __table_args__ = (UniqueConstraint("attempt_id", "question_id", name="uq_attempt_answers_attempt_question"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    attempt_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)

    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    answer_json: Mapped[dict] = mapped_column(JSONB, nullable=False)

    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    awarded_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    auto_submitted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    time_spent_ms: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
