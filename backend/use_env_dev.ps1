Set-Location $PSScriptRoot
Copy-Item -Force ".env.dev" ".env"
Write-Host "[OK] backend/.env switched to DEV profile (.env.dev)" -ForegroundColor Green
