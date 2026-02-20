from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.enums import AttemptStatus
from app.models.models import AdminUser, Attempt, Participant
from app.schemas.public import AdminLoginRequest, AdminLoginResponse, StatsSummaryResponse
from app.services.auth import ADMIN_COOKIE_NAME, cookie_params, create_admin_token, get_admin_from_cookie
from app.services.security import verify_password

router = APIRouter(prefix="/admin")


def require_admin(admin_token: str | None = Cookie(default=None, alias=ADMIN_COOKIE_NAME)) -> None:
    if not get_admin_from_cookie(admin_token):
        raise HTTPException(status_code=403, detail="admin_required")


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(payload: AdminLoginRequest, response: Response, db: AsyncSession = Depends(get_db)) -> AdminLoginResponse:
    # В проде: добавить rate limit по Redis и хранить пароль админа только в БД.
    user = (await db.execute(select(AdminUser).where(AdminUser.username == "admin", AdminUser.is_active.is_(True)))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=403, detail="admin_not_configured")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=403, detail="bad_password")

    token = create_admin_token()
    response.set_cookie(key=ADMIN_COOKIE_NAME, value=token, **cookie_params())
    return AdminLoginResponse()


@router.post("/logout")
async def admin_logout(response: Response) -> dict:
    response.delete_cookie(key=ADMIN_COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/stats/summary", response_model=StatsSummaryResponse, dependencies=[Depends(require_admin)])
async def stats_summary(db: AsyncSession = Depends(get_db)) -> StatsSummaryResponse:
    # registered = количество участников (participants)
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
