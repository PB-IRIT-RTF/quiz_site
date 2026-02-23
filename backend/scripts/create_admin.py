from __future__ import annotations

import argparse
import asyncio
import os
import sys

from sqlalchemy import select

from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models.models import AdminUser
from app.services.security import hash_password


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create or rotate an admin user in the database."
    )
    parser.add_argument(
        "--username",
        default=os.getenv("ADMIN_USERNAME", "admin"),
        help="Admin username (default: env ADMIN_USERNAME or 'admin').",
    )
    parser.add_argument(
        "--password",
        default=os.getenv("ADMIN_PASSWORD"),
        help="Admin password (default: env ADMIN_PASSWORD).",
    )
    parser.add_argument(
        "--rotate-password",
        action="store_true",
        help="If user exists, rotate password and activate user.",
    )
    return parser.parse_args()


def validate_inputs(username: str, password: str | None) -> str:
    if not username or not username.strip():
        raise ValueError("username must be non-empty")
    if password is None or len(password) < 12:
        raise ValueError(
            "password is required and must be at least 12 characters "
            "(pass via --password or env ADMIN_PASSWORD)"
        )
    return username.strip()


async def create_or_rotate_admin(
    *,
    username: str,
    password: str,
    rotate_password: bool,
) -> int:
    # Keep behavior consistent with the app startup: ensure schema exists.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(select(AdminUser).where(AdminUser.username == username).limit(1))
        ).scalar_one_or_none()

        if existing is None:
            db.add(
                AdminUser(
                    username=username,
                    password_hash=hash_password(password),
                    is_active=True,
                )
            )
            await db.commit()
            print(f"[OK] admin user '{username}' created")
            return 0

        if rotate_password:
            existing.password_hash = hash_password(password)
            existing.is_active = True
            await db.commit()
            print(f"[OK] admin user '{username}' password rotated and user activated")
            return 0

        print(
            f"[SKIP] admin user '{username}' already exists. "
            "Use --rotate-password to update password."
        )
        return 0


async def _main() -> int:
    args = parse_args()
    try:
        username = validate_inputs(args.username, args.password)
    except ValueError as e:
        print(f"[ERR] {e}", file=sys.stderr)
        return 2

    try:
        return await create_or_rotate_admin(
            username=username,
            password=args.password,  # validated above
            rotate_password=bool(args.rotate_password),
        )
    finally:
        await engine.dispose()


def main() -> int:
    return asyncio.run(_main())


if __name__ == "__main__":
    raise SystemExit(main())
