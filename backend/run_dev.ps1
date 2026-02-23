# Запуск backend для локальной разработки (Windows PowerShell)
# 1) Создайте venv и поставьте зависимости:
#    cd backend
#    py -m venv .venv
#    .\.venv\Scripts\Activate.ps1
#    pip install -r requirements.txt
# 2) Запуск:
#    .\run_dev.ps1

Set-Location $PSScriptRoot

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
  Write-Host "[ERR] venv не найден: backend/.venv. Создайте его командой: py -m venv .venv" -ForegroundColor Red
  exit 1
}

$env:ENVIRONMENT = "dev"
$env:COOKIE_SECURE = "false"
$env:DEMO_SEED = "true"

Write-Host "[OK] Starting backend on http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "[OK] Health: http://127.0.0.1:8000/api/health" -ForegroundColor Green

& .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
