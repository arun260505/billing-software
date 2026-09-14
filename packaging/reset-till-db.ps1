<#
  reset-till-db.ps1  —  Start this till over CLEAN.

  What it does, in plain words:
    1. Stops the InWallz services.
    2. Deletes ONLY this PC's local database (the copy of the shop's data on this
       machine). Nothing on the cloud is touched.
    3. After it runs, you install InWallzSetup.exe again with your key — the till
       rebuilds a fresh database and pulls everything (menu, staff, settings)
       down from the cloud again, correctly.

  WARNING: this erases the LOCAL database on this PC. Only use it on a till you
  are setting up / switching (like this one). Anything already synced to the
  cloud is safe and comes back on the next sync.

  HOW TO RUN:
    1. Right-click Start > "Windows PowerShell (Admin)".
    2. Paste:  powershell -ExecutionPolicy Bypass -File "<path>\reset-till-db.ps1"
    3. Then run InWallzSetup.exe and enter the salon key when asked.
#>
$ErrorActionPreference = "Continue"
function Say($m) { Write-Host "[reset] $m" -ForegroundColor Cyan }

# 1) Find where InWallz is installed.
$InstallDir = @(
    "$env:SystemDrive\InWallz",
    "${env:ProgramFiles(x86)}\InWallz",
    "$env:ProgramFiles\InWallz"
) | Where-Object { Test-Path (Join-Path $_ "data") } | Select-Object -First 1
if (-not $InstallDir) { Write-Host "Could not find an InWallz install with a data folder. Nothing to do."; exit }
Say "Install: $InstallDir"

$nssm = Join-Path $InstallDir "nssm.exe"
$data = Join-Path $InstallDir "data"

# 2) Stop the services so the database files are no longer in use.
Say "Stopping InWallz services..."
if (Test-Path $nssm) {
    & $nssm stop InWallzServer 2>&1 | Out-Null
    & $nssm stop InWallzMySQL  2>&1 | Out-Null
} else {
    Stop-Service InWallzServer -Force -ErrorAction SilentlyContinue
    Stop-Service InWallzMySQL  -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3

# 3) Delete the local database folder.
if (Test-Path $data) {
    Say "Deleting the local database ($data) ..."
    try {
        Remove-Item $data -Recurse -Force -ErrorAction Stop
        Say "Local database deleted."
    } catch {
        Say "Could not delete it (a file is still in use). Reboot the PC once, then run this again."
        exit
    }
} else {
    Say "No local database folder found — already clean."
}

Say ""
Say "DONE. Now run InWallzSetup.exe (the new one) and enter the salon key:"
Say "    INWZ-GJJA-AKWR"
Say "Keep the PC on the internet. After it finishes, wait ~1 minute for the sync,"
Say "then log in with:  glowowner  /  Glow@2026"
