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

if not exist "%ROOT_DIR%dist\index.html" (
    echo Build frontend non trovato. Avvio della build...
    call npm.cmd run build
    if errorlevel 1 (
        echo Errore durante la build del frontend.
        pause
        exit /b 1
    )
)

echo Avvio applicazione CARRA per uso cliente...
start "CARRA Cliente" /D "%ROOT_DIR%" "%NODE_EXE%" server\index.js

echo.
echo Applicazione disponibile su http://localhost:3001
echo.

start "" "http://localhost:3001"

endlocal
