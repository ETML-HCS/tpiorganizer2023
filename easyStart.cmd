@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "PS_SCRIPT=%ROOT%start-dev.ps1"
set "PAUSE_ON_ERROR=1"
if /I "%~1"=="--no-pause" set "PAUSE_ON_ERROR="

if not exist "%PS_SCRIPT%" call :die "Script introuvable: %PS_SCRIPT%" 1
if not exist "%ROOT%package.json" call :die "package.json introuvable dans %ROOT%" 1

where node >nul 2>nul || call :die "Node.js introuvable dans le PATH" 1
where npm >nul 2>nul || call :die "npm introuvable dans le PATH" 1

set "PS_BIN="
where pwsh >nul 2>nul && set "PS_BIN=pwsh"
if not defined PS_BIN where powershell >nul 2>nul && set "PS_BIN=powershell"
if not defined PS_BIN call :die "PowerShell introuvable (pwsh/powershell)" 1

where code >nul 2>nul && start "" code "%ROOT%"
if errorlevel 1 echo [WARN] Commande code introuvable. VS Code non lance.

echo [INFO] Lancement via %PS_BIN%...
"%PS_BIN%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" call :die "Echec du demarrage (code %EXIT_CODE%)" %EXIT_CODE%

echo [OK] Demarrage termine.
endlocal & exit /b 0

:die
echo [ERROR] %~1
if defined PAUSE_ON_ERROR pause
endlocal & exit /b %~2
