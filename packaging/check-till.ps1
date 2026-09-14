<#
  check-till.ps1 — report an InWallz till's state, to diagnose login/sync issues.
  Run in PowerShell (admin not required):
    powershell -ExecutionPolicy Bypass -File check-till.ps1
#>
$ErrorActionPreference = "Continue"

$InstallDir = @(
    "$env:SystemDrive\InWallz",
    "${env:ProgramFiles(x86)}\InWallz",
    "$env:ProgramFiles\InWallz"
) | Where-Object { Test-Path (Join-Path $_ "app\backend\.env") } | Select-Object -First 1
if (-not $InstallDir) { Write-Host "No InWallz install found."; exit }
Write-Host "Install: $InstallDir"

$envText = Get-Content (Join-Path $InstallDir "app\backend\.env") -Raw
$key   = ([regex]::Match($envText, "(?m)^ACTIVATION_KEY=(.*)$")).Groups[1].Value.Trim()
$port  = ([regex]::Match($envText, "(?m)^PORT=(\d+)")).Groups[1].Value
$dbPass= ([regex]::Match($envText, "(?m)^DB_PASSWORD=(.*)$")).Groups[1].Value.Trim()
$dbPort= ([regex]::Match($envText, "(?m)^DB_PORT=(\d+)")).Groups[1].Value
if (-not $dbPort) { $dbPort = "3307" }
Write-Host "Activation key in .env: $key"
Write-Host "App port: $port   DB port: $dbPort"

$mysql = Join-Path $InstallDir "mysql\bin\mysql.exe"
function Q($sql) { & $mysql -u inwallz "--password=$dbPass" -h 127.0.0.1 "--port=$dbPort" inwallz_billing -N -e $sql 2>$null }

Write-Host "`n-- Activation (local) --"
Q "SELECT CONCAT('restaurant_uuid=', IFNULL(restaurant_uuid,'(none)'), '  activated_at=', IFNULL(activated_at,'(none)')) FROM activation WHERE id=1;"
Write-Host "`n-- This till's restaurant --"
Q "SELECT CONCAT(restaurant_name, '  |  business_type=', IFNULL(business_type,'(blank)')) FROM restaurants;"
Write-Host "`n-- Users on this till (you log in with these) --"
Q "SELECT CONCAT(username, '  [', role, ', ', status, ']') FROM users WHERE deleted_at IS NULL ORDER BY role;"
$cnt = Q "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;"
Write-Host "  total users: $cnt"

Write-Host "`n-- Internet / cloud reachable? --"
try {
    $r = Invoke-WebRequest "https://billing.inwallz.in/api/health" -UseBasicParsing -TimeoutSec 8
    Write-Host "  cloud: reachable (HTTP $($r.StatusCode))"
} catch {
    try { $null = Invoke-WebRequest "https://billing.inwallz.in" -UseBasicParsing -TimeoutSec 8; Write-Host "  cloud: reachable" }
    catch { Write-Host "  cloud: NOT reachable — sync can't pull data. Check internet. ($($_.Exception.Message))" }
}

Write-Host "`nIf 'total users' is 0 or the salon users aren't listed, the till hasn't"
Write-Host "pulled them yet — make sure it's online and wait ~1 minute, then re-check."
