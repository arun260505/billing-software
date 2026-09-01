# exe-mode.ps1  -  Switch this PC back to running the packaged EXE.
#
# Stops the dev stack's hold on 5000 / 3306 (dev MySQL + any dev backend) and
# starts the exe services, so http://localhost:5000 serves the installed till.
#
# Usage:  right-click > Run with PowerShell   (it self-elevates to admin)
#         or:  powershell -ExecutionPolicy Bypass -File exe-mode.ps1

param([string]$DevMySql = "MySQL80")

# --- self-elevate to admin ---
$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
if (-not $admin) {
    Start-Process powershell -Verb RunAs -ArgumentList @(
        "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"", "-DevMySql", $DevMySql
    )
    return
}

function Stop-Svc($name) {
    $s = Get-Service $name -ErrorAction SilentlyContinue
    if ($s -and $s.Status -ne "Stopped") { Stop-Service $name -Force -ErrorAction SilentlyContinue; Write-Host "  stopped: $name" }
}

Write-Host "== Switching to EXE mode ==" -ForegroundColor Cyan

# Kill any dev backend still holding port 5000 (nodemon / node server.js).
$owner = (Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($owner) {
    $p = Get-Process -Id $owner -ErrorAction SilentlyContinue
    if ($p -and $p.ProcessName -match "node") {
        Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
        Write-Host "  killed dev backend on :5000 (pid $owner)"
    }
}

Write-Host "Releasing dev MySQL:"
Stop-Svc $DevMySql

Write-Host "Starting the exe services:"
Start-Service InWallzMySQL -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Start-Service InWallzServer -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2
Get-Service InWallzMySQL, InWallzServer -ErrorAction SilentlyContinue | Format-Table Name, Status -AutoSize

Write-Host "Till should be live at http://localhost:5000" -ForegroundColor Green
Write-Host "Press Enter to close..."
[void](Read-Host)
