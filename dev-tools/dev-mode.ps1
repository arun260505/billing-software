# dev-mode.ps1  -  Switch this PC to DEVELOPMENT.
#
# The exe (InWallzServer + InWallzMySQL) and your dev stack both want port 5000
# and MySQL 3306, so they can't run together. This frees those ports for
# development: it stops the exe services and makes sure your dev MySQL is up.
#
# After running this:
#     cd backend ; npm run dev      # dev backend on http://localhost:5000
#     npm start                     # dev frontend on http://localhost:3000
#
# Flip back with exe-mode.ps1 to test the packaged app again.
#
# Usage:  right-click > Run with PowerShell   (it self-elevates to admin)
#         or:  powershell -ExecutionPolicy Bypass -File dev-mode.ps1

param([string]$DevMySql = "MySQL80")

# --- self-elevate to admin (needed to stop/start services) ---
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
    if ($s) {
        if ($s.Status -ne "Stopped") { Stop-Service $name -Force -ErrorAction SilentlyContinue }
        Set-Service $name -StartupType Manual -ErrorAction SilentlyContinue
        Write-Host "  stopped + set Manual: $name"
    }
}
function Start-Svc($name) {
    $s = Get-Service $name -ErrorAction SilentlyContinue
    if ($s) {
        if ($s.Status -ne "Running") { Start-Service $name -ErrorAction SilentlyContinue }
        Write-Host "  started: $name"
    } else {
        Write-Host "  (service '$name' not found - skip; edit -DevMySql if your dev MySQL has another name)"
    }
}

Write-Host "== Switching to DEVELOPMENT mode ==" -ForegroundColor Cyan
Write-Host "Freeing ports 5000 / 3306 from the exe:"
Stop-Svc "InWallzServer"
Stop-Svc "InWallzMySQL"
Write-Host "Bringing up your dev MySQL:"
Start-Svc $DevMySql

Write-Host ""
Write-Host "Ready for development." -ForegroundColor Green
Write-Host "  1) cd backend ; npm run dev     (backend  -> http://localhost:5000)"
Write-Host "  2) npm start                    (frontend -> http://localhost:3000)"
Write-Host ""
Write-Host "Run exe-mode.ps1 when you want the packaged app back."
Write-Host "Press Enter to close..."
[void](Read-Host)
