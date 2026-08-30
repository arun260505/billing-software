<#
  install-services.ps1 — set up InWallz on a restaurant PC as unattended services.
  Runs on the target machine (elevated) — invoked by the Inno Setup installer,
  or by hand for testing. Expects this layout under -InstallDir:

    node\node.exe            portable Node runtime (matching build ABI; pure JS so lenient)
    app\backend\             backend + node_modules + .env.template
    app\build\               React UI
    mysql\bin\mysqld.exe     MySQL (extracted from the Community ZIP)
    nssm.exe                 the Non-Sucking Service Manager
    data\                    (created here) MySQL data directory

  What it does: generates per-machine secrets, initialises + starts MySQL,
  creates the app DB/user, imports the schema, writes backend\.env, registers
  two auto-starting services (MySQL first), and opens the firewall for the LAN.
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
$mysqld  = Join-Path $InstallDir "mysql\bin\mysqld.exe"
$mysql   = Join-Path $InstallDir "mysql\bin\mysql.exe"
$dataDir = Join-Path $InstallDir "data"
$backend = Join-Path $InstallDir "app\backend"
$schema  = Join-Path $InstallDir "app\inwallz_schema.sql"   # ship the schema-only dump here

# --- 1) Per-machine secrets ------------------------------------------------
Say "Generating per-machine secrets"
Add-Type -AssemblyName System.Web
$dbPass  = ([System.Web.Security.Membership]::GeneratePassword(28, 4) -replace '[^A-Za-z0-9]', 'x') + "Aa1"
$jwt     = -join ((1..64) | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })

# --- 2) Initialise + start MySQL as a service ------------------------------
Say "Initialising MySQL"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    & $mysqld --initialize-insecure "--datadir=$dataDir" "--basedir=$(Join-Path $InstallDir 'mysql')"
}

Say "Registering InWallzMySQL service"
& $nssm install InWallzMySQL $mysqld "--datadir=$dataDir" "--basedir=$(Join-Path $InstallDir 'mysql')" "--port=3306"
& $nssm set InWallzMySQL Start SERVICE_AUTO_START
& $nssm set InWallzMySQL AppExit Default Restart
& $nssm start InWallzMySQL
Start-Sleep -Seconds 8   # let InnoDB come up

# --- 3) Create app DB, user, import schema ---------------------------------
Say "Creating database + app user"
# On --initialize-insecure the root password is empty on first run.
& $mysql -u root -e @"
ALTER USER 'root'@'localhost' IDENTIFIED BY '$dbPass-root';
CREATE DATABASE IF NOT EXISTS inwallz_billing CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'inwallz'@'localhost' IDENTIFIED BY '$dbPass';
GRANT ALL PRIVILEGES ON inwallz_billing.* TO 'inwallz'@'localhost';
FLUSH PRIVILEGES;
"@
if (Test-Path $schema) {
    & $mysql -u inwallz "-p$dbPass" inwallz_billing -e "source $schema"
}

# --- 4) Write backend\.env from the template -------------------------------
Say "Writing backend\.env"
$tpl = Get-Content (Join-Path $backend ".env.template") -Raw
$tpl = $tpl -replace "__DB_PASSWORD__", $dbPass
$tpl = $tpl -replace "__JWT_SECRET__", $jwt
$tpl = $tpl -replace "__ACTIVATION_KEY__", $ActivationKey
$tpl = $tpl -replace "CLOUD_SYNC_URL=.*", "CLOUD_SYNC_URL=$CloudUrl"
$tpl = $tpl -replace "PORT=.*", "PORT=$Port"
$tpl | Out-File (Join-Path $backend ".env") -Encoding utf8

# --- 5) Register the backend service (depends on MySQL) --------------------
Say "Registering InWallzServer service"
& $nssm install InWallzServer $node (Join-Path $backend "server.js")
& $nssm set InWallzServer AppDirectory $backend
& $nssm set InWallzServer Start SERVICE_AUTO_START
& $nssm set InWallzServer AppExit Default Restart
& $nssm set InWallzServer DependOnService InWallzMySQL
& $nssm start InWallzServer

# --- 6) Firewall: allow the LAN to reach the till on $Port (Private only) ---
Say "Opening firewall port $Port (Private)"
netsh advfirewall firewall add rule name="InWallz $Port" dir=in action=allow `
    protocol=TCP localport=$Port profile=private | Out-Null

Say "Done. The till is at http://localhost:$Port  (waiters use http://<this-PC-IP>:$Port)"
