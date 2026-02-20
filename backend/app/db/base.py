from __future__ import annotations

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Naming convention помогает Alembic корректно генерировать имена индексов/constraint'ов
# и затем делать downgrade без угадываний.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


# ВАЖНО: импорт моделей, чтобы они зарегистрировались в Base.metadata
# (иначе Alembic env.py увидит пустую метадату)
from app.models import models as _models  # noqa: E402,F401
