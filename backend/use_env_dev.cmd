@echo off
cd /d %~dp0
copy /Y ".env.dev" ".env" >nul
echo [OK] backend/.env switched to DEV profile (.env.dev)
