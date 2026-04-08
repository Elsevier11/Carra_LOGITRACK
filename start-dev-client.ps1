param(
  [switch]$InstallDependencies
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ClientDir = Join-Path $ScriptDir 'client'

Write-Host "Switching to $ClientDir"
Set-Location $ClientDir

if ($InstallDependencies) {
  Write-Host "Installazione dipendenze client..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install è fallito."
    exit $LASTEXITCODE
  }
}

Write-Host "Avvio client in sviluppo (Vite)..."
npm run dev
