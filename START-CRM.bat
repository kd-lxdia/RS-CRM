@echo off
title SLAR CRM Launcher
echo ============================================
echo   SLAR CRM - Starting Backend + Frontend
echo ============================================
cd /d "%~dp0"
start "SLAR Backend (port 4000)" cmd /k "cd backend && npm run dev"
timeout /t 5 /nobreak >nul
start "SLAR Frontend (port 3005)" cmd /k "cd frontend && npm run dev"
timeout /t 8 /nobreak >nul
start http://localhost:3005
echo.
echo Dono servers khul gaye. Band karne ke liye dono cmd windows close karein.
pause
