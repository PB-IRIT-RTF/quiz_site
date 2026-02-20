from __future__ import annotations

from fastapi import APIRouter

from app.api import admin, public

api_router = APIRouter(prefix="/api")

api_router.include_router(public.router, tags=["public"])
api_router.include_router(admin.router, tags=["admin"])
