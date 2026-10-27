# Starts every service and the frontend locally, each in its own PowerShell window.
# Usage (from the repo root):  powershell -ExecutionPolicy Bypass -File scripts\dev-all.ps1

$root = Split-Path -Parent $PSScriptRoot
$apps = @(
  "backend\guard-service",
  "backend\auth-service",
  "backend\speech-service",
  "backend\resume-service",
  "backend\report-service",
  "backend\interview-service",
  "backend\gateway-service",
  "frontend"
)

foreach ($app in $apps) {
  $path = Join-Path $root $app
  if (-not (Test-Path (Join-Path $path ".env"))) {
    Write-Warning "$app has no .env file - copy .env.example to .env first. Skipping."
    continue
  }
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$path'; `$host.UI.RawUI.WindowTitle = '$app'; npm run dev"
}

Write-Host "Started. Frontend: http://localhost:5173  Gateway: http://localhost:4000/api/health"
