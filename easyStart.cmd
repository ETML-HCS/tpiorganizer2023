@echo off
:: Définissez le répertoire de travail actuel
set CWD=%CD%

:: Ouvrez Windows Terminal
wt -p "PowerShell" -d "%CWD%" powershell -NoExit -Command "code ." ; ^
split-pane -H -p "PowerShell" -d "%CWD%" powershell -NoExit -Command npm run client ; ^
sp -V -p "PowerShell" -d "%CWD%" node ./src/srvMongoDB.js
