# Build the InWallz WAITER APK (LAN app for the restaurant floor).
# ASCII-only, no here-strings, so it parses cleanly under Windows PowerShell 5.1.
#
# CRITICAL: the waiter app must build with NO baked REACT_APP_API_URL. The repo's
# .env.production sets REACT_APP_API_URL=/api for the SAME-ORIGIN cashier build
# (UI + API on one machine). If that leaks into the waiter APK, the phone posts
# every request (login, tables, menu, orders) to its OWN origin, gets the app's
# index.html back, and nothing works (login "does nothing", lists empty). This
# was a real field outage.
#
# So this writes a temporary .env.production.local that BLANKS REACT_APP_API_URL
# (and REACT_APP_TARGET) - it takes precedence over .env.production for the build
# - then removes it. With no baked URL, resolveApiBaseUrl() uses the till address
# discovered on the WiFi (services/discovery.js) or entered manually.
#
# Run from the repo root:  powershell -File packaging\build-waiter-apk.ps1

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot          # ...\billing-software
$override = Join-Path $repo ".env.production.local"

Write-Host "1/5  Writing temporary env override (blank REACT_APP_API_URL)..." -ForegroundColor Cyan
Set-Content -Path $override -Value @("REACT_APP_API_URL=", "REACT_APP_TARGET=") -Encoding Ascii

try {
    Set-Location $repo

    Write-Host "2/5  Building the React bundle (LAN, no baked API URL)..." -ForegroundColor Cyan
    $env:GENERATE_SOURCEMAP = "false"
    $env:CI = "false"
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "React build failed" }

    # Guard: the baked bundle must NOT return "/api" as the API base.
    $bundle = Get-ChildItem "$repo\build\static\js\main.*.js" | Select-Object -First 1
    if (Select-String -Path $bundle.FullName -Pattern 'return"/api"' -SimpleMatch -Quiet) {
        throw "Bundle baked /api as the API base - the LAN override did not take. Aborting."
    }
    Write-Host "     guard OK: no /api baked" -ForegroundColor DarkGray

    Write-Host "3/5  Syncing into the Android project..." -ForegroundColor Cyan
    & npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw "cap sync failed" }

    Write-Host "4/5  Assembling the debug APK..." -ForegroundColor Cyan
    Set-Location "$repo\android"
    & .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "gradle assembleDebug failed" }
    Set-Location $repo

    Write-Host "5/5  Exporting the APK..." -ForegroundColor Cyan
    $out = "$repo\packaging\Output"
    if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }
    $stamp = Get-Date -Format "yyyyMMdd-HHmm"
    $dest = Join-Path $out "InWallz-Waiter-$stamp-LAN.apk"
    Copy-Item "$repo\android\app\build\outputs\apk\debug\app-debug.apk" $dest -Force
    Write-Host "`nDONE -> $dest" -ForegroundColor Green
}
finally {
    if (Test-Path $override) { Remove-Item $override -Force }
    Remove-Item Env:\GENERATE_SOURCEMAP -ErrorAction SilentlyContinue
    Remove-Item Env:\CI -ErrorAction SilentlyContinue
}
