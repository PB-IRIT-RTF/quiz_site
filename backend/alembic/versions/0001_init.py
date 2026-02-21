"""init

Revision ID: 0001_init
Revises:
Create Date: 2026-02-20

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quizzes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("published", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "participants",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("fio_raw", sa.Text(), nullable=False),
        sa.Column("fio_norm", sa.Text(), nullable=False),
        sa.Column("group_raw", sa.Text(), nullable=False),
        sa.Column("group_norm", sa.Text(), nullable=False),
        sa.Column("vk_url_raw", sa.Text(), nullable=False),
        sa.Column("vk_url_norm", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_unique_constraint("uq_participants_fio_group", "participants", ["fio_norm", "group_norm"])

    op.create_table(
        "attempts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("quiz_id", sa.Integer(), sa.ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("participant_id", sa.Integer(), sa.ForeignKey("participants.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("registered", "in_progress", "finished", "forced_finished", name="attempt_status"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("score", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_time_ms", sa.BigInteger(), nullable=True),
        sa.Column("current_question_order", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("current_question_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint("uq_attempt_quiz_participant", "attempts", ["quiz_id", "participant_id"])
    # SQLite: создаём обычный составной индекс; направление сортировки учитывается запросом.
    op.create_index(
        "ix_attempts_leaderboard",
        "attempts",
        ["quiz_id", "score", "total_time_ms", "finished_at"],
        unique=False,
    )

    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("quiz_id", sa.Integer(), sa.ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("type", sa.Enum("single", "multi", "text", name="question_type"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("time_limit_seconds", sa.Integer(), nullable=True),
    )
    op.create_unique_constraint("uq_questions_quiz_order", "questions", ["quiz_id", "order"])

    op.create_table(
        "options",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )

    op.create_table(
        "text_answer_rules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("match_type", sa.Enum("exact", "regex", name="text_match_type"), nullable=False),
        sa.Column("pattern", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )

    op.create_table(
        "question_media",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Enum("image", "audio", "video", "embed", name="media_kind"), nullable=False),
        sa.Column("source_type", sa.Enum("upload", "url", name="media_source_type"), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("mime", sa.Text(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )

    op.create_table(
        "attempt_answers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("attempt_id", sa.Integer(), sa.ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("answer_json", sa.JSON(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("awarded_points", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("auto_submitted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("time_spent_ms", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
    )
    op.create_unique_constraint("uq_attempt_answers_attempt_question", "attempt_answers", ["attempt_id", "question_id"])


def downgrade() -> None:
    op.drop_constraint("uq_attempt_answers_attempt_question", "attempt_answers", type_="unique")
    op.drop_table("attempt_answers")

    op.drop_table("question_media")
    op.drop_table("text_answer_rules")
    op.drop_table("options")

    op.drop_constraint("uq_questions_quiz_order", "questions", type_="unique")
    op.drop_table("questions")

    op.drop_index("ix_attempts_leaderboard", table_name="attempts")
    op.drop_constraint("uq_attempt_quiz_participant", "attempts", type_="unique")
    op.drop_table("attempts")

    op.drop_constraint("uq_participants_fio_group", "participants", type_="unique")
    op.drop_table("participants")

    op.drop_table("quizzes")

    # SQLite doesn't support DROP TYPE; enums are stored as VARCHAR / CHECK constraints
