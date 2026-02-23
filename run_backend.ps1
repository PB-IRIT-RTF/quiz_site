# Запуск backend (Windows PowerShell) из корня репозитория
# Требования: backend/.venv создан и зависимости установлены

Set-Location (Join-Path $PSScriptRoot "backend")

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
  Write-Host "[ERR] venv не найден: backend/.venv. Создайте его: cd backend; py -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt" -ForegroundColor Red
  exit 1
}

$env:ENVIRONMENT = "dev"
$env:COOKIE_SECURE = "false"
$env:DEMO_SEED = "true"

Write-Host "[OK] Starting backend on http://127.0.0.1:8000" -ForegroundColor Green
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
