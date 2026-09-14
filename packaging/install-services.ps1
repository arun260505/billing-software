<#
  install-services.ps1 - set up InWallz on a restaurant PC as unattended services.
  Runs elevated (invoked by the Inno Setup installer, or by hand for testing).
  ASCII-only and here-string-free so it parses cleanly under Windows PowerShell 5.1.
#>

param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$ActivationKey,
    [string]$CloudUrl = "https://billing.inwallz.in",
    # 5050 + 3307 (not the usual 5000/3306) so the installed till never collides
    # with a developer's local backend/MySQL on the same machine.
    [int]$Port = 5050,
    [int]$DbPort = 3307
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

# 1) Update vs fresh install.
# An UPDATE keeps the existing database, .env (DB password + JWT + activation
# key) and the activation row untouched - only the app code is refreshed and the
# services restarted. That is what makes reinstalling a new version over a
# client's till safe: no data loss, no re-typing the activation key. A FRESH
# install (no .env / no data) generates secrets and needs the activation key.
$envFile = Join-Path $backend ".env"
$isUpdate = $false
$keySwitch = $false
$existingKey = ""
$dbPass = $null
$jwt = $null
if ((Test-Path $envFile) -and (Test-Path (Join-Path $dataDir "mysql"))) {
    $existingEnv = Get-Content $envFile -Raw
    $mPass = [regex]::Match($existingEnv, "(?m)^DB_PASSWORD=(.*)$")
    if ($mPass.Success -and $mPass.Groups[1].Value.Trim() -ne "") {
        $isUpdate = $true
        $dbPass = $mPass.Groups[1].Value.Trim()
        # Keep the ports the existing install already uses.
        $mPort = [regex]::Match($existingEnv, "(?m)^PORT=(\d+)")
        if ($mPort.Success) { $Port = [int]$mPort.Groups[1].Value }
        $mDbPort = [regex]::Match($existingEnv, "(?m)^DB_PORT=(\d+)")
        if ($mDbPort.Success) { $DbPort = [int]$mDbPort.Groups[1].Value }
        $mKey = [regex]::Match($existingEnv, "(?m)^ACTIVATION_KEY=(.*)$")
        if ($mKey.Success) { $existingKey = $mKey.Groups[1].Value.Trim() }
    }
}

# A DIFFERENT activation key on an existing install means "repurpose this till"
# (e.g. a restaurant machine now running a salon). Keep the database engine and
# secrets, but repoint .env to the new key and clear the activation + sync cursor
# so the server re-activates and pulls the NEW business's data. Without this the
# update path would silently keep the old key, and the new owner's logins - which
# don't exist in the old business's data - would all read "invalid credentials".
if ($isUpdate -and $ActivationKey -and $ActivationKey.Trim() -ne "" -and $ActivationKey.Trim() -ne $existingKey) {
    $keySwitch = $true
}

if ($keySwitch) {
    Say "Existing install found - SWITCHING activation to the new key (keeping DB engine, re-syncing the new business)"
} elseif ($isUpdate) {
    Say "Existing install found - UPDATE mode (keeping database, .env and activation)"
} else {
    Say "Fresh install - generating per-machine secrets"
    if (-not $ActivationKey -or $ActivationKey.Trim() -eq "") {
        throw "An activation key is required for a new install."
    }
    Add-Type -AssemblyName System.Web
    $dbPass = ([System.Web.Security.Membership]::GeneratePassword(24, 0) -replace '[^A-Za-z0-9]', 'x') + "Aa1"
    $jwt    = -join ((1..64) | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })
}

# 2) Initialise MySQL, register + start its service.
Say "Initialising MySQL"
if (-not (Test-Path (Join-Path $dataDir "mysql"))) {
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    & $mysqld "--datadir=$dataDir" "--basedir=$mysqlBd" --initialize-insecure
}

# NSSM passes AppParameters verbatim; spaces in "Program Files (x86)" would chop
# the paths (mysqld saw datadir as 'C:\Program'). Use short 8.3 paths, which have
# no spaces, so no quoting is needed.
$fso = New-Object -ComObject Scripting.FileSystemObject
$dataShort = $fso.GetFolder($dataDir).ShortPath
$baseShort = $fso.GetFolder($mysqlBd).ShortPath

# Guarantee a passwordless root on every start. A data folder KEPT from a prior
# install can carry a root that has a password (or a mismatched auth plugin),
# and then setup - which logs in as passwordless root - fails with "Access
# denied" and never registers InWallzServer. Applying this via --init-file makes
# the install self-heal on any device; it is a harmless no-op on a fresh init.
$rootReset = Join-Path $InstallDir "reset-root.sql"
"ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';" | Out-File $rootReset -Encoding ascii
$rootResetShort = $fso.GetFile($rootReset).ShortPath

Say "Registering InWallzMySQL service"
& $nssm install InWallzMySQL $mysqld
# bind-address=0.0.0.0 so the backend can reach MySQL over IPv4 loopback
# (mysqld otherwise binds '::' / IPv6, and the backend's 127.0.0.1 times out).
# --init-file resets root to passwordless on each start (see above).
& $nssm set InWallzMySQL AppParameters "--datadir=$dataShort --basedir=$baseShort --port=$DbPort --bind-address=0.0.0.0 --init-file=$rootResetShort"
& $nssm set InWallzMySQL Start SERVICE_AUTO_START
& $nssm set InWallzMySQL AppStdout (Join-Path $logs "mysql.log")
& $nssm set InWallzMySQL AppStderr (Join-Path $logs "mysql.log")
& $nssm set InWallzMySQL AppThrottle 5000
& $nssm start InWallzMySQL

# Wait until MySQL actually accepts connections (InnoDB recovery can be slow).
Say "Waiting for MySQL to accept connections"
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
    & $mysql -u root -h 127.0.0.1 "--port=$DbPort" -e "SELECT 1" 2>$null | Out-Null
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
& $mysql -u root -h 127.0.0.1 "--port=$DbPort" -e $sql
# Import the schema ONLY on a fresh, empty database. On a reinstall the tables
# already exist (with pulled/local data), and the dump's DROP TABLE would wipe
# them - so skip it.
$tableCount = & $mysql -u inwallz "--password=$dbPass" -h 127.0.0.1 "--port=$DbPort" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='inwallz_billing'" 2>$null
$tableCount = [int]($tableCount | Select-Object -First 1)
if ((Test-Path $schema) -and ($tableCount -eq 0)) {
    Get-Content $schema -Raw | & $mysql -u inwallz "--password=$dbPass" -h 127.0.0.1 "--port=$DbPort" inwallz_billing
    Say "Schema imported (fresh DB)"
} else {
    Say "Existing database kept ($tableCount tables) - schema import skipped"
}

# 4) Write backend\.env from the template - FRESH install only. On an update the
# existing .env (DB password + JWT + activation key) is kept as-is, so the till
# stays connected to its data and its restaurant with nothing to re-enter.
if (-not $isUpdate) {
    Say "Writing backend .env"
    $tpl = Get-Content (Join-Path $backend ".env.template") -Raw
    $tpl = $tpl -replace "__DB_PASSWORD__", $dbPass
    $tpl = $tpl -replace "__JWT_SECRET__", $jwt
    $tpl = $tpl -replace "__ACTIVATION_KEY__", $ActivationKey
    $tpl = $tpl -replace "CLOUD_SYNC_URL=.*", ("CLOUD_SYNC_URL=" + $CloudUrl)
    # Anchor to line start so this does NOT also match DB_PORT.
    $tpl = $tpl -replace "(?m)^PORT=.*", ("PORT=" + $Port)
    $tpl = $tpl -replace "(?m)^DB_PORT=.*", ("DB_PORT=" + $DbPort)
    $tpl | Out-File (Join-Path $backend ".env") -Encoding ascii

    # 4b) Honour the activation key entered in THIS install. The data folder can be
    # kept from a prior fresh attempt, so an old activation row would make the
    # server think it is "already activated" and ignore the key just entered.
    # Clear it so the server re-activates with the entered key. Skipped on an
    # update, where the existing activation must be preserved.
    & $mysql -u inwallz "--password=$dbPass" -h 127.0.0.1 "--port=$DbPort" inwallz_billing -e "UPDATE activation SET restaurant_uuid=NULL, sync_key=NULL, activated_at=NULL WHERE id=1;" 2>$null | Out-Null
} elseif ($keySwitch) {
    Say "Repointing .env to the new activation key and clearing the old activation"
    # Swap ONLY the activation key line; keep DB password, JWT and ports.
    $envText = Get-Content $envFile -Raw
    if ($envText -match "(?m)^ACTIVATION_KEY=") {
        $envText = $envText -replace "(?m)^ACTIVATION_KEY=.*", ("ACTIVATION_KEY=" + $ActivationKey.Trim())
    } else {
        $envText = $envText.TrimEnd() + "`r`nACTIVATION_KEY=" + $ActivationKey.Trim() + "`r`n"
    }
    $envText | Out-File $envFile -Encoding ascii
    # Clear the stored activation AND the sync cursor so the server re-activates
    # with the new key and re-pulls the new business's data from the start.
    & $mysql -u inwallz "--password=$dbPass" -h 127.0.0.1 "--port=$DbPort" inwallz_billing -e "UPDATE activation SET restaurant_uuid=NULL, sync_key=NULL, activated_at=NULL WHERE id=1; DELETE FROM sync_state;" 2>$null | Out-Null
} else {
    Say "Keeping existing .env and activation (update)"
}

# 4c) Keep the till logged in (trusted on-premise device) — no 8h re-login. Set
# a long token life in the .env on every install, including updates from an old
# 8h build.
try {
    $envKeep = Get-Content $envFile -Raw
    if ($envKeep -match "(?m)^JWT_EXPIRES_IN=") {
        $envKeep = $envKeep -replace "(?m)^JWT_EXPIRES_IN=.*", "JWT_EXPIRES_IN=3650d"
    } else {
        $envKeep = $envKeep.TrimEnd() + "`r`nJWT_EXPIRES_IN=3650d`r`n"
    }
    $envKeep | Out-File $envFile -Encoding ascii
} catch { Say "Could not set token life: $($_.Exception.Message)" }

# 5) Register the backend service (depends on MySQL).
Say "Registering InWallzServer service"
$backendShort = $fso.GetFolder($backend).ShortPath
& $nssm install InWallzServer $node
& $nssm set InWallzServer AppParameters (Join-Path $backendShort "server.js")
& $nssm set InWallzServer AppDirectory $backendShort
& $nssm set InWallzServer Start SERVICE_AUTO_START
& $nssm set InWallzServer AppStdout (Join-Path $logs "server.log")
& $nssm set InWallzServer AppStderr (Join-Path $logs "server.log")
& $nssm set InWallzServer AppThrottle 5000
& $nssm set InWallzServer DependOnService InWallzMySQL
& $nssm start InWallzServer

# 6) Firewall: allow the LAN (waiter phones) to reach the till on $Port.
# Open on ALL profiles - restaurant Wi-Fi often registers as Public, and a
# Private-only rule would silently block the phones there.
Say "Opening firewall port $Port (all profiles)"
netsh advfirewall firewall delete rule name="InWallz $Port" 2>$null | Out-Null
netsh advfirewall firewall add rule name="InWallz $Port" dir=in action=allow protocol=TCP localport=$Port profile=any | Out-Null

# 7) The till now runs as its own native window (till\InWallzTill.exe, a WebView2
# shell), so the icon is drawn by Windows from the exe - crisp, like the installer.
# Edge's force-installed PWA is no longer used; remove that policy if a prior
# version set it, so Edge stops auto-installing the old blurry PWA.
try {
    $pol = "HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebAppInstallForceList"
    if (Test-Path $pol) { Remove-Item $pol -Recurse -Force -ErrorAction SilentlyContinue }
} catch { }

# 8) Pre-warm the RAW printer helper: compile its DLL once now so the very first
# bill/kitchen ticket prints instantly instead of paying a one-time ~2s compile.
Say "Warming up the printer helper"
try {
    $printScript = Join-Path $backend "scripts\print-text.ps1"
    if (Test-Path $printScript) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $printScript -WarmOnly 2>&1 | Out-Null
    }
} catch {
    Say "Printer warm-up skipped: $($_.Exception.Message)"
}

# 9) Desktop shortcut -> the native till app (till\InWallzTill.exe). Windows draws
# the icon from the exe's embedded .ico, so it is crisp. Delete any old shortcuts
# first so an update never piles up "InWallz Till (1)", "(2)", ...
Say "Removing old till desktop shortcuts"
$desktopDirs = @()
try { $desktopDirs += [Environment]::GetFolderPath("CommonDesktopDirectory") } catch {}
try { $desktopDirs += [Environment]::GetFolderPath("Desktop") } catch {}
foreach ($dk in ($desktopDirs | Select-Object -Unique)) {
    if ($dk -and (Test-Path $dk)) {
        # Remove the current name and the old "InWallz Till" name it replaced.
        Get-ChildItem -Path $dk -Include "InWallz Billing*.lnk","InWallz Till*.lnk" -ErrorAction SilentlyContinue |
            Remove-Item -Force -ErrorAction SilentlyContinue
        foreach ($nm in @("InWallz Billing","InWallz Till")) {
            Get-ChildItem -Path $dk -Filter "$nm*.lnk" -ErrorAction SilentlyContinue |
                Remove-Item -Force -ErrorAction SilentlyContinue
        }
    }
}

Say "Creating the till desktop shortcut"
$till = Join-Path $InstallDir "till\InWallzTill.exe"
try {
    $dest = $null
    try { $dest = [Environment]::GetFolderPath("CommonDesktopDirectory") } catch {}
    if (-not ($dest -and (Test-Path $dest))) { $dest = [Environment]::GetFolderPath("Desktop") }
    $lnk = Join-Path $dest "InWallz Billing.lnk"

    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($lnk)
    $sc.TargetPath = $till
    $sc.Arguments = "http://localhost:$Port/"
    $sc.IconLocation = "$till,0"
    $sc.WorkingDirectory = (Split-Path $till)
    $sc.Description = "InWallz Billing"
    $sc.Save()
    Say "Desktop shortcut created: $lnk"
} catch {
    Say "Could not create the desktop shortcut: $($_.Exception.Message)"
}

Say "Opening the till"
try {
    Start-Process -FilePath $till -ArgumentList "http://localhost:$Port/" -WorkingDirectory (Split-Path $till)
} catch {
    Say "Could not open the till automatically: $($_.Exception.Message)"
}

Start-Sleep -Seconds 3
Say "Service status"
Get-Service InWallzMySQL, InWallzServer -ErrorAction SilentlyContinue |
    Format-Table Name, Status, StartType -AutoSize

Say "Done. Till at http://localhost:$Port . Logs in $logs"
