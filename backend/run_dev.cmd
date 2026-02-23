@echo off
REM Запуск backend для локальной разработки (Windows cmd)
REM 1) Создайте venv и поставьте зависимости:
REM    cd backend
REM    py -m venv .venv
REM    .\.venv\Scripts\activate
REM    pip install -r requirements.txt
REM 2) Запуск:
REM    run_dev.cmd

cd /d %~dp0

if not exist ".\.venv\Scripts\python.exe" (
  echo [ERR] venv не найден: backend\.venv. Создайте его: py -m venv .venv
  exit /b 1
)

set ENVIRONMENT=dev
set COOKIE_SECURE=false
set DEMO_SEED=true

echo [OK] Starting backend on http://127.0.0.1:8000
echo [OK] Health: http://127.0.0.1:8000/api/health
echo.

".\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
