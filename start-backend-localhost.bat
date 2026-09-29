@echo off
cd /d "%~dp0"
echo starting backend at %DATE% %TIME% >> backend-localhost.log
set "DOTENV_CONFIG_PATH=%~dp0backend\.env"
set "TS_NODE_COMPILER_OPTIONS={""module"":""commonjs"",""moduleResolution"":""node""}"
node -r dotenv/config -r ts-node/register/transpile-only backend\src\index.ts >> backend-localhost.log 2>> backend-localhost.err.log
