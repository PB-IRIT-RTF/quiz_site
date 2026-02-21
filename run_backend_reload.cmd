@echo off
cd /d %~dp0\backend

if not exist ".\.venv\Scripts\python.exe" (
  echo [ERR] venv не найден: backend\.venv
  exit /b 1
)

set DEMO_SEED=true

echo [OK] Starting backend (reload) on http://127.0.0.1:8000
".\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
