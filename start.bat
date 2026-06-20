@echo off
title CARRA - Dev Server
cd /d "%~dp0"
echo Avvio CARRA in modalita sviluppo...
start "CARRA Backend" cmd /k "node server/index.js"
timeout /t 2 /nobreak >nul
start "CARRA Frontend" cmd /k "npx vite"
echo.
echo Backend e Frontend avviati.
echo   Backend:  http://localhost:3000
echo   Frontend: http://localhost:5173
echo.
pause
