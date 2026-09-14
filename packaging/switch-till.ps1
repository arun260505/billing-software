<#
  switch-till.ps1 — repoint an already-installed InWallz till to a DIFFERENT
  restaurant/salon, without reinstalling. Keeps the database engine + secrets,
  swaps the activation key, clears the old activation + sync cursor so the till
  re-activates and pulls the new business's data, restarts the backend, and
  (re)creates the desktop shortcut.

  Run in an ADMIN PowerShell:
    powershell -ExecutionPolicy Bypass -File switch-till.ps1 -ActivationKey INWZ-XXXX-XXXX

  With no key it defaults to the Glow Salon key below.
#>
param(
    [string]$ActivationKey = "INWZ-GJJA-AKWR"
)

$ErrorActionPreference = "Stop"
function Say($m) { Write-Host "[switch] $m" -ForegroundColor Cyan }

# 1) Find the install.
$InstallDir = @(
    "$env:SystemDrive\InWallz",
    "${env:ProgramFiles(x86)}\InWallz",
    "$env:ProgramFiles\InWallz"
) | Where-Object { Test-Path (Join-Path $_ "app\backend\.env") } | Select-Object -First 1
if (-not $InstallDir) { throw "Could not find an InWallz install (no app\backend\.env)." }
Say "Install: $InstallDir"

$envFile = Join-Path $InstallDir "app\backend\.env"
$mysql   = Join-Path $InstallDir "mysql\bin\mysql.exe"
$nssm    = Join-Path $InstallDir "nssm.exe"

# 2) Read DB password + port from .env.
$envText = Get-Content $envFile -Raw
$dbPass = ([regex]::Match($envText, "(?m)^DB_PASSWORD=(.*)$")).Groups[1].Value.Trim()
$dbPort = ([regex]::Match($envText, "(?m)^DB_PORT=(\d+)")).Groups[1].Value
if (-not $dbPort) { $dbPort = "3307" }
if (-not $dbPass) { throw "No DB_PASSWORD in .env — cannot reach the database." }

# 3) Swap the activation key in .env (keep everything else).
Say "Setting activation key to $ActivationKey"
if ($envText -match "(?m)^ACTIVATION_KEY=") {
    $envText = $envText -replace "(?m)^ACTIVATION_KEY=.*", ("ACTIVATION_KEY=" + $ActivationKey.Trim())
} else {
    $envText = $envText.TrimEnd() + "`r`nACTIVATION_KEY=" + $ActivationKey.Trim() + "`r`n"
}
$envText | Out-File $envFile -Encoding ascii

# 4) Clear the stored activation + sync cursor so it re-activates + re-pulls.
Say "Clearing old activation and sync cursor"
& $mysql -u inwallz "--password=$dbPass" -h 127.0.0.1 "--port=$dbPort" inwallz_billing -e "UPDATE activation SET restaurant_uuid=NULL, sync_key=NULL, activated_at=NULL WHERE id=1; DELETE FROM sync_state;" 2>$null | Out-Null

# 5) Restart the backend so it re-activates on boot.
Say "Restarting the till service"
if (Test-Path $nssm) { & $nssm restart InWallzServer 2>&1 | Out-Null }
else { Restart-Service InWallzServer -Force }

# 6) (Re)create the desktop shortcut with the InWallz logo.
Say "Creating the desktop shortcut"
try {
    $port = ([regex]::Match($envText, "(?m)^PORT=(\d+)")).Groups[1].Value
    if (-not $port) { $port = "5050" }
    $edge = @(
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    $icon = Join-Path $InstallDir "app\build\favicon.ico"
    $dest = [Environment]::GetFolderPath("Desktop")
    foreach ($nm in @("InWallz Billing","InWallz Till")) {
        Get-ChildItem -Path $dest -Filter "$nm*.lnk" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    }
    $lnk = Join-Path $dest "InWallz Billing.lnk"
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($lnk)
    $sc.TargetPath = if ($edge) { $edge } else { "msedge.exe" }
    $sc.Arguments = "--app=http://localhost:$port/"
    if (Test-Path $icon) { $sc.IconLocation = "$icon,0" }
    if ($edge) { $sc.WorkingDirectory = (Split-Path $edge) }
    $sc.Description = "InWallz Billing"
    $sc.Save()
    Say "Shortcut created: $lnk"
} catch { Say "Could not create the shortcut: $($_.Exception.Message)" }

Say "Done. Give it ~30-60s to pull the new business's data, then log in."
