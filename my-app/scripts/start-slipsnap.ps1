# Starts SlipSnap for hosting through Tailscale Funnel: the API on 127.0.0.1:8000 and the
# production build on 127.0.0.1:4173. Run from anywhere: powershell -File scripts\start-slipsnap.ps1
$ErrorActionPreference = 'Stop'
$app = Split-Path -Parent $PSScriptRoot
Set-Location $app

& "$app\backend\.venv\Scripts\python.exe" -m alembic -c backend/alembic.ini upgrade head
Start-Process -WindowStyle Minimized -WorkingDirectory $app -FilePath "$app\backend\.venv\Scripts\python.exe" `
    -ArgumentList '-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', '8000'
Start-Process -WindowStyle Minimized -WorkingDirectory $app -FilePath 'npm.cmd' -ArgumentList 'run', 'serve'

Write-Host 'SlipSnap is starting: http://127.0.0.1:4173 (Tailscale Funnel publishes this port).'
