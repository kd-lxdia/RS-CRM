@echo off
cd /d "%~dp0"
echo Starting SLAR 2.0 backend and frontend...
node start-backend-detached.js
node start-frontend-detached.js
echo.
echo SLAR 2.0 is starting.
echo Backend:  http://localhost:4000/health
echo Frontend: http://localhost:3005
echo Login:    demo-admin@slarcrm.com / Password@123
echo.
echo Backend can take up to 60 seconds on first start.
