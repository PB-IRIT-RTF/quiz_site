@echo off
REM Запуск backend (Windows CMD) из корня репозитория

cd /d %~dp0\backend

if not exist ".\.venv\Scripts\python.exe" (
  echo [ERR] venv не найден: backend\.venv
  echo Создайте его: cd backend ^& py -m venv .venv ^& .\.venv\Scripts\activate ^& pip install -r requirements.txt
  exit /b 1
)

set DEMO_SEED=true

echo [OK] Starting backend on http://127.0.0.1:8000
".\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
