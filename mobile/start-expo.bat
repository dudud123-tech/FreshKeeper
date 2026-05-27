@echo off
setlocal
cd /d "%~dp0"

if "%1"=="--dev-client" (
  npx.cmd expo start --localhost --dev-client
) else (
  npx.cmd expo start --localhost
)
