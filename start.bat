@echo off
chcp 65001 >nul

echo Запуск Secure DocFlow...

cd /d "%~dp0"

start cmd /k "cd backend && npm run dev"

timeout /t 3 >nul

start cmd /k "cd frontend && npm run dev"

timeout /t 5 >nul

start http://localhost:5178