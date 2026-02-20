from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Cookie, HTTPException
from jose import jwt

from app.core.config import settings


ALGORITHM = "HS256"
COOKIE_NAME = "quiz_token"
ADMIN_COOKIE_NAME = "admin_token"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_participant_token(participant_id: int) -> str:
    payload = {
        "sub": str(participant_id),
        "typ": "participant",
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(days=1)).timestamp()),
    }
    return jwt.encode(payload, settings.cookie_secret, algorithm=ALGORITHM)


def create_admin_token() -> str:
    payload = {
        "sub": "admin",
        "typ": "admin",
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(hours=12)).timestamp()),
    }
    return jwt.encode(payload, settings.cookie_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.cookie_secret, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="invalid_token")


def get_participant_id_from_cookie(token: str | None) -> int:
    if not token:
        raise HTTPException(status_code=401, detail="not_authenticated")
    data = decode_token(token)
    if data.get("typ") != "participant":
        raise HTTPException(status_code=401, detail="wrong_token_type")
    return int(data["sub"])


def get_admin_from_cookie(token: str | None) -> bool:
    if not token:
        return False
    data = decode_token(token)
    return data.get("typ") == "admin"


def cookie_params() -> dict:
    return {
        "httponly": True,
        "secure": bool(settings.cookie_secure),
        "samesite": "lax",
        "path": "/",
    }
