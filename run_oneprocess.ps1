# 1) Собирает фронт (dist/)
# 2) Запускает backend, который раздаёт dist/ и /api

Set-Location $PSScriptRoot

Write-Host "[1/2] Build frontend..." -ForegroundColor Cyan
npm install
npm run build

Write-Host "[2/2] Start backend..." -ForegroundColor Cyan
.\run_backend.ps1
