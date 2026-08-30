<#
  install-services.ps1 — set up InWallz on a restaurant PC as unattended services.
  Runs elevated (invoked by the Inno Setup installer, or by hand for testing).

  Layout under -InstallDir:
    node\node.exe            portable Node runtime
    app\backend\             backend + node_modules + .env.template
    app\build\               React UI
    app\inwallz_schema.sql   schema-only dump
    mysql\bin\mysqld.exe     MySQL runtime (bin + share + lib\plugin)
    nssm.exe                 service manager
    vc_redist.x64.exe        Microsoft VC++ runtime (MySQL depends on it)
    data\                    (created here) MySQL data directory
    logs\                    (created here) service stdout/stderr
#>

param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$ActivationKey,
    [string]$CloudUrl = "https://billing.inwallz.in",
    [int]$Port = 5000
)

$ErrorActionPreference = "Stop"
function Say($m) { Write-Host "== $m ==" -ForegroundColor Cyan }

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

# --- 0) MySQL needs the Microsoft VC++ runtime; install it (idempotent) ------
Say "Installing VC++ runtime (MySQL dependency)"
$vc = Join-Path $InstallDir "vc_redist.x64.exe"
if (Test-Path $vc) {
    Start-Process $vc -ArgumentList "/install", "/quiet", "/norestart" -Wait
}

# --- 0b) Clean any previous (possibly paused/failed) services ----------------
Say "Removing any previous InWallz services"
foreach ($svc in "InWallzServer", "InWallzMySQL") {
    & $nssm stop $svc 2>$null | Out-Null
    & $nssm remove $svc confirm 2>$null | Out-Null
}
Start-Sleep -Seconds 2

# --- 1) Per-machine secrets --------------------------------------------------
Say "Generating per-machine secrets"
Add-Type -AssemblyName System.Web
$dbPass = ([System.Web.Security.Membership]::GeneratePassword(24, 0) -replace '[^A-Za-z0-9]', 'x') + "Aa1"
$jwt    = -join ((1..64) | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })

# --- 2) Initialise MySQL, register + start its service -----------------------
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
if (-not $ready) { throw "MySQL did not become ready — see $logs\mysql.log" }

# --- 3) Create app DB, user, import schema -----------------------------------
Say "Creating database + app user"
& $mysql -u root -e @"
CREATE DATABASE IF NOT EXISTS inwallz_billing CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'inwallz'@'localhost' IDENTIFIED BY '$dbPass';
ALTER USER 'inwallz'@'localhost' IDENTIFIED BY '$dbPass';
GRANT ALL PRIVILEGES ON inwallz_billing.* TO 'inwallz'@'localhost';
FLUSH PRIVILEGES;
"@
if (Test-Path $schema) {
    & $mysql -u inwallz "-p$dbPass" inwallz_billing -e "source $schema"
}

# --- 4) Write backend\.env from the template ---------------------------------
Say "Writing backend\.env"
$tpl = Get-Content (Join-Path $backend ".env.template") -Raw
$tpl = $tpl -replace "__DB_PASSWORD__", $dbPass
$tpl = $tpl -replace "__JWT_SECRET__", $jwt
$tpl = $tpl -replace "__ACTIVATION_KEY__", $ActivationKey
$tpl = $tpl -replace "CLOUD_SYNC_URL=.*", "CLOUD_SYNC_URL=$CloudUrl"
$tpl = $tpl -replace "PORT=.*", "PORT=$Port"
$tpl | Out-File (Join-Path $backend ".env") -Encoding utf8

# --- 5) Register the backend service (depends on MySQL) ----------------------
Say "Registering InWallzServer service"
& $nssm install InWallzServer $node (Join-Path $backend "server.js")
& $nssm set InWallzServer AppDirectory $backend
& $nssm set InWallzServer Start SERVICE_AUTO_START
& $nssm set InWallzServer AppStdout (Join-Path $logs "server.log")
& $nssm set InWallzServer AppStderr (Join-Path $logs "server.log")
& $nssm set InWallzServer AppThrottle 5000
& $nssm set InWallzServer DependOnService InWallzMySQL
& $nssm start InWallzServer

# --- 6) Firewall: allow the LAN to reach the till on $Port (Private only) -----
Say "Opening firewall port $Port (Private)"
netsh advfirewall firewall delete rule name="InWallz $Port" 2>$null | Out-Null
netsh advfirewall firewall add rule name="InWallz $Port" dir=in action=allow `
    protocol=TCP localport=$Port profile=private | Out-Null

Say "Done. Till at http://localhost:$Port  (waiters: http://<this-PC-IP>:$Port). Logs in $logs"
