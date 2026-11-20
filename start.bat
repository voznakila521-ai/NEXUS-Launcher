@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
if not exist "node_modules\electron" (
  echo First run install.bat
  pause
  exit /b 1
)
npm start
