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

function Invoke-Npm {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & npm @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Resolve-ProdPort {
    $resolvedPort = ''

    if ($env:PORT) {
        $resolvedPort = $env:PORT
    } else {
        $resolvedPort = (& node -e "require('./API/config/loadEnv'); console.log(process.env.PORT || '8080')" | Select-Object -Last 1)
    }

    $parsedPort = 0

    if ([int]::TryParse($resolvedPort, [ref]$parsedPort)) {
        return $parsedPort
    }

    Write-Host "PORT invalide dans l'environnement: $resolvedPort. Utilisation de 8080." -ForegroundColor Yellow
    return 8080
}

function Open-SiteWhenReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    Start-Job -ScriptBlock {
        param([string]$TargetUrl)

        for ($attempt = 1; $attempt -le 60; $attempt++) {
            try {
                $response = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2

                if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                    Start-Process $TargetUrl
                    return
                }
            } catch {
                Start-Sleep -Seconds 1
            }
        }
    } -ArgumentList $Url | Out-Null
}

if (-not (Test-Path node_modules)) {
    Write-Host "node_modules absents -> npm install" -ForegroundColor Yellow
    Invoke-Npm -Arguments @('install')
}

$env:NODE_ENV = 'production'
$env:REACT_APP_DEBUG = 'false'
$prodPort = Resolve-ProdPort

Stop-ProjectProcessOnPort -Port $prodPort

Write-Host "Checking production configuration..." -ForegroundColor Cyan
Invoke-Npm -Arguments @('run', 'check-env-prod')

Write-Host "Building frontend client..." -ForegroundColor Cyan
Invoke-Npm -Arguments @('run', 'build:app')

Open-SiteWhenReady -Url "http://localhost:${prodPort}"

Write-Host "Starting production server on port ${prodPort}..." -ForegroundColor Cyan
Invoke-Npm -Arguments @('run', 'start:prod')
