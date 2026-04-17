#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Always run from repo root
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Stop-ProjectProcessOnPort {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $listeners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue

    foreach ($listener in $listeners) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue

        if ($null -eq $process) {
            continue
        }

        $commandLine = $process.CommandLine

        if ($commandLine -and ($commandLine -match 'serverAPI\.js|vite\.js|vite\\bin\\vite\.js')) {
            Write-Host "Stopping existing process on port ${Port}: $commandLine" -ForegroundColor Yellow
            Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}

Stop-ProjectProcessOnPort -Port 5001
Stop-ProjectProcessOnPort -Port 3000

# Install deps if missing
if (-not (Test-Path node_modules)) {
    Write-Host "node_modules absents -> npm install" -ForegroundColor Yellow
    npm install
}

Write-Host "Starting frontend+backend (npm run dev:5001)..." -ForegroundColor Cyan
npm run dev:5001
