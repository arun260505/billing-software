# =============================================================================
#  Build the InWallz Billing owner APK (salon-owner alerts app)
# =============================================================================
#  The owner app is the same React bundle built with REACT_APP_TARGET=owner and
#  the cloud API baked in, wrapped in a Capacitor Android shell whose identity is
#  com.inwallz.billing / "InWallz Billing" with the InWallz logo.
#
#  WHY THE android/ FOLDER IS COPIED FROM ../android
#  A fresh `npx cap add android` scaffold (Capacitor 8 default, AGP 8.13) fails to
#  build on this machine ("Could not determine dependencies ... IOException").
#  The waiter project (../android) is hand-tuned to build here (AGP pinned to
#  8.9.3, org.gradle.java.home -> Android Studio JBR 21, a local Gradle dist,
#  suppressUnsupportedCompileSdk). So we reuse that proven config and just
#  rebrand the applicationId + app name + icons. `cap sync` then rewires the
#  plugins (adds local-notifications) and copies the owner web build in.
#
#  Run from the repo root:  powershell -File owner-app\build-owner-apk.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot          # ...\billing-software
$owner = $PSScriptRoot                            # ...\billing-software\owner-app
$cloud = "https://billing.inwallz.in/api"

Write-Host "1/6  Building the owner-mode React bundle..." -ForegroundColor Cyan
Push-Location $repo
$env:REACT_APP_TARGET = "owner"
$env:REACT_APP_API_URL = $cloud
$env:GENERATE_SOURCEMAP = "false"
$env:CI = "false"
& npm run build
if ($LASTEXITCODE -ne 0) { throw "React build failed" }
Pop-Location

Write-Host "2/6  Installing owner-app Capacitor deps (if needed)..." -ForegroundColor Cyan
Push-Location $owner
if (-not (Test-Path "$owner\node_modules")) { & npm install }

Write-Host "3/6  Copying web build into www..." -ForegroundColor Cyan
if (Test-Path "$owner\www") { Remove-Item "$owner\www" -Recurse -Force }
New-Item -ItemType Directory -Path "$owner\www" | Out-Null
Copy-Item "$repo\build\*" "$owner\www" -Recurse -Force

Write-Host "4/6  Preparing the branded Android project (from the proven waiter config)..." -ForegroundColor Cyan
if (-not (Test-Path "$owner\android\app\build.gradle")) {
    Copy-Item "$repo\android" "$owner\android" -Recurse -Force
    foreach ($d in @("build", ".gradle", "app\build", ".idea", "app\src\main\assets\public")) {
        if (Test-Path "$owner\android\$d") { Remove-Item "$owner\android\$d" -Recurse -Force }
    }
    if (Test-Path "$owner\android\app\google-services.json") { Remove-Item "$owner\android\app\google-services.json" -Force }

    # Rebrand: installed app id + display name + url scheme. Keep the Java
    # namespace (com.inwallz.waiter) so MainActivity/R resolve unchanged.
    (Get-Content "$owner\android\app\build.gradle") `
        -replace 'applicationId "com.inwallz.waiter"', 'applicationId "com.inwallz.billing"' |
        Set-Content "$owner\android\app\build.gradle" -Encoding utf8

    $strings = "$owner\android\app\src\main\res\values\strings.xml"
    (Get-Content $strings) `
        -replace '>InWallz Waiter<', '>InWallz Billing<' `
        -replace 'custom_url_scheme">com.inwallz.waiter<', 'custom_url_scheme">com.inwallz.billing<' |
        Set-Content $strings -Encoding utf8
}

Write-Host "5/6  Syncing Capacitor (plugins + web assets) and generating icons..." -ForegroundColor Cyan
# Icon source = the InWallz brand logo, centered on a dark ground for the launcher.
if (-not (Test-Path "$owner\assets")) { New-Item -ItemType Directory -Path "$owner\assets" | Out-Null }
Copy-Item "$repo\src\assets\inwallz-logo.png" "$owner\assets\logo.png" -Force
& npx cap sync android
if ($LASTEXITCODE -ne 0) { throw "cap sync failed" }
& npx --yes "@capacitor/assets" generate --android `
    --iconBackgroundColor '#0e1016' --iconBackgroundColorDark '#0e1016' `
    --splashBackgroundColor '#0e1016' --splashBackgroundColorDark '#0e1016'

Write-Host "6/6  Assembling the debug APK..." -ForegroundColor Cyan
Push-Location "$owner\android"
& .\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { throw "gradle assembleDebug failed" }
Pop-Location
Pop-Location

$out = "$repo\packaging\Output"
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }
Copy-Item "$owner\android\app\build\outputs\apk\debug\app-debug.apk" "$out\InWallzBilling.apk" -Force
Write-Host "`nDONE -> $out\InWallzBilling.apk" -ForegroundColor Green
