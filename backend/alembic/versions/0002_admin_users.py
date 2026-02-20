"""admin users

Revision ID: 0002_admin_users
Revises: 0001_init
Create Date: 2026-02-20

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_admin_users"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_users",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("username", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_unique_constraint("uq_admin_users_username", "admin_users", ["username"])


def downgrade() -> None:
    op.drop_constraint("uq_admin_users_username", "admin_users", type_="unique")
    op.drop_table("admin_users")
