@echo off
setlocal

rem Avvia il client Vite in modalità sviluppo
cd /d "%~dp0client"

echo Avvio del client in sviluppo (Vite)...
call npm.cmd install
if errorlevel 1 (
  echo Errore durante l'installazione delle dipendenze del client.
  pause
  exit /b 1
)

call npm.cmd run dev

endlocal
