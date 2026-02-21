# Запуск backend c autoreload (Windows PowerShell)
Set-Location $PSScriptRoot

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
  Write-Host "[ERR] venv не найден: backend/.venv" -ForegroundColor Red
  exit 1
}

$env:DEMO_SEED = "true"

Write-Host "[OK] Starting backend (reload) on http://127.0.0.1:8000" -ForegroundColor Green
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
