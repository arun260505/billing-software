<#
  install-services.ps1 - set up InWallz on a restaurant PC as unattended services.
  Runs elevated (invoked by the Inno Setup installer, or by hand for testing).
  ASCII-only and here-string-free so it parses cleanly under Windows PowerShell 5.1.
#>

param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$ActivationKey,
    [string]$CloudUrl = "https://billing.inwallz.in",
    [int]$Port = 5000
)

# Native tools (nssm, mysql) write harmless notices to stderr; under "Stop" those
# abort the script. Use "Continue" and validate the critical steps explicitly.
$ErrorActionPreference = "Continue"
function Say($m) { Write-Host ("== " + $m + " ==") -ForegroundColor Cyan }

$nssm    = Join-Path $InstallDir "nssm.exe"
$node    = Join-Path $InstallDir "node\node.exe"
$mysqlBd = Join-Path $InstallDir "mysql"
$mysqld  = Join-Path $mysqlBd "bin\mysqld.exe"
$mysql   = Join-Path $mysqlBd "bin\mysql.exe"
$dataDir = Join-Path $InstallDir "data"
$logs    = Join-Path $InstallDir "logs"
$backend = Join-Path $InstallDir "app\backend"
$schema  = Join-Path $InstallDir "app\inwallz_schema.sql"

New-Item -ItemType Directory -Force -Path $logs | Out-Null

# 0) MySQL needs the Microsoft VC++ runtime; install it (idempotent).
Say "Installing VC++ runtime (MySQL dependency)"
$vc = Join-Path $InstallDir "vc_redist.x64.exe"
if (Test-Path $vc) {
    Start-Process $vc -ArgumentList "/install", "/quiet", "/norestart" -Wait
}

# 0b) Clean any previous (possibly paused/failed) services. These fail loudly
# when the service doesn't exist yet - expected, so swallow it.
Say "Removing any previous InWallz services"
foreach ($svc in "InWallzServer", "InWallzMySQL") {
    try { & $nssm stop $svc 2>&1 | Out-Null } catch {}
    try { & $nssm remove $svc confirm 2>&1 | Out-Null } catch {}
}
Start-Sleep -Seconds 2

# 1) Per-machine secrets.
Say "Generating per-machine secrets"
Add-Type -AssemblyName System.Web
$dbPass = ([System.Web.Security.Membership]::GeneratePassword(24, 0) -replace '[^A-Za-z0-9]', 'x') + "Aa1"
$jwt    = -join ((1..64) | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })

# 2) Initialise MySQL, register + start its service.
Say "Initialising MySQL"
if (-not (Test-Path (Join-Path $dataDir "mysql"))) {
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    & $mysqld "--datadir=$dataDir" "--basedir=$mysqlBd" --initialize-insecure
}

Say "Registering InWallzMySQL service"
& $nssm install InWallzMySQL $mysqld "--datadir=$dataDir" "--basedir=$mysqlBd" "--port=3306"
& $nssm set InWallzMySQL Start SERVICE_AUTO_START
& $nssm set InWallzMySQL AppStdout (Join-Path $logs "mysql.log")
& $nssm set InWallzMySQL AppStderr (Join-Path $logs "mysql.log")
& $nssm set InWallzMySQL AppThrottle 5000
& $nssm start InWallzMySQL

# Wait until MySQL actually accepts connections (InnoDB recovery can be slow).
Say "Waiting for MySQL to accept connections"
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
    & $mysql -u root -e "SELECT 1" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    throw ("MySQL did not become ready. See " + (Join-Path $logs "mysql.log"))
}

# 3) Create app DB, user, import schema. Single-line SQL (no here-string).
Say "Creating database + app user"
$sql = "CREATE DATABASE IF NOT EXISTS inwallz_billing CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;" +
       " CREATE USER IF NOT EXISTS 'inwallz'@'localhost' IDENTIFIED BY '$dbPass';" +
       " ALTER USER 'inwallz'@'localhost' IDENTIFIED BY '$dbPass';" +
       " GRANT ALL PRIVILEGES ON inwallz_billing.* TO 'inwallz'@'localhost';" +
       " FLUSH PRIVILEGES;"
& $mysql -u root -e $sql
if (Test-Path $schema) {
    Get-Content $schema -Raw | & $mysql -u inwallz "--password=$dbPass" inwallz_billing
}

# 4) Write backend\.env from the template.
Say "Writing backend .env"
$tpl = Get-Content (Join-Path $backend ".env.template") -Raw
$tpl = $tpl -replace "__DB_PASSWORD__", $dbPass
$tpl = $tpl -replace "__JWT_SECRET__", $jwt
$tpl = $tpl -replace "__ACTIVATION_KEY__", $ActivationKey
$tpl = $tpl -replace "CLOUD_SYNC_URL=.*", ("CLOUD_SYNC_URL=" + $CloudUrl)
$tpl = $tpl -replace "PORT=.*", ("PORT=" + $Port)
$tpl | Out-File (Join-Path $backend ".env") -Encoding ascii

# 5) Register the backend service (depends on MySQL).
Say "Registering InWallzServer service"
& $nssm install InWallzServer $node (Join-Path $backend "server.js")
& $nssm set InWallzServer AppDirectory $backend
& $nssm set InWallzServer Start SERVICE_AUTO_START
& $nssm set InWallzServer AppStdout (Join-Path $logs "server.log")
& $nssm set InWallzServer AppStderr (Join-Path $logs "server.log")
& $nssm set InWallzServer AppThrottle 5000
& $nssm set InWallzServer DependOnService InWallzMySQL
& $nssm start InWallzServer

# 6) Firewall: allow the LAN to reach the till on $Port (Private only).
Say "Opening firewall port $Port (Private)"
netsh advfirewall firewall delete rule name="InWallz $Port" 2>$null | Out-Null
netsh advfirewall firewall add rule name="InWallz $Port" dir=in action=allow protocol=TCP localport=$Port profile=private | Out-Null

Start-Sleep -Seconds 3
Say "Service status"
Get-Service InWallzMySQL, InWallzServer -ErrorAction SilentlyContinue |
    Format-Table Name, Status, StartType -AutoSize

Say "Done. Till at http://localhost:$Port . Logs in $logs"
