@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "NODE_EXE="

for /f "delims=" %%I in ('where node 2^>nul') do (
    set "NODE_EXE=%%I"
    goto :node_found
)

if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    goto :node_found
)

echo Errore: Node.js non trovato.
echo Installare Node.js e assicurarsi che il comando `node` sia disponibile nel PATH.
pause
exit /b 1

:node_found

where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo Errore: npm.cmd non trovato nel PATH.
    echo Verificare l'installazione di Node.js.
    pause
    exit /b 1
)

echo Avvio backend CARRA...
start "CARRA Backend" /D "%ROOT_DIR%" "%NODE_EXE%" server\index.js

echo Avvio frontend Vite...
start "CARRA Frontend" /D "%ROOT_DIR%" cmd /k "npm.cmd run dev"

echo.
echo Backend disponibile su http://localhost:3001
echo Frontend Vite disponibile su http://127.0.0.1:5173
echo.
echo L'app completa funziona sia su http://localhost:3001 sia in sviluppo su http://127.0.0.1:5173

endlocal
