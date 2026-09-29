@echo off
cd /d "%~dp0"
echo starting frontend at %DATE% %TIME% >> frontend-localhost.log
set VITE_API_URL=http://localhost:4000/api
cd frontend
..\node_modules\.bin\vite.cmd --config vite.local.config.mjs --host 127.0.0.1 --port 3005 --strictPort --force >> ..\frontend-localhost.log 2>> ..\frontend-localhost.err.log
