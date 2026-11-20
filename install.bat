@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo ========================================
echo   NEXUS Launcher - install dependencies
echo ========================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Download LTS from https://nodejs.org/  (need 22.12+)
  pause
  exit /b 1
)
echo Node:
node -v
echo npm:
npm -v
echo.
echo Installing dependencies (electron + minecraft-kit)...
call npm install
if errorlevel 1 (
  echo.
  echo npm install failed.
  echo Check internet and Node version.
  pause
  exit /b 1
)
echo.
echo ========================================
echo   Done! Run start.bat
echo ========================================
pause
