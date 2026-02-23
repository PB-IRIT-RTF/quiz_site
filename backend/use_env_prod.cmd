@echo off
cd /d %~dp0
copy /Y ".env.prod" ".env" >nul
echo [OK] backend/.env switched to PROD profile (.env.prod)
echo [WARN] Replace COOKIE_SECRET and FRONTEND_ORIGINS before starting in production.
