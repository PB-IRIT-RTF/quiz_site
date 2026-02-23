Set-Location $PSScriptRoot
Copy-Item -Force ".env.prod" ".env"
Write-Host "[OK] backend/.env switched to PROD profile (.env.prod)" -ForegroundColor Green
Write-Host "[WARN] Replace COOKIE_SECRET and FRONTEND_ORIGINS before starting in production." -ForegroundColor Yellow
