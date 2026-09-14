<#
  fetch-webview2.ps1 — download the WebView2 SDK and place the DLLs in .\lib
  (Core + WinForms managed assemblies, and the native WebView2Loader for x64).
  Run once before build-till.ps1 on a fresh checkout.
#>
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ver  = "1.0.2592.51"
$lib  = Join-Path $here "lib"
New-Item -ItemType Directory -Force -Path $lib | Out-Null

$tmp = Join-Path $env:TEMP ("wv2_" + $ver)
$zip = "$tmp.zip"
Invoke-WebRequest "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$ver" -OutFile $zip -TimeoutSec 120
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $tmp -Force

Copy-Item (Join-Path $tmp "lib\net462\Microsoft.Web.WebView2.Core.dll")     $lib -Force
Copy-Item (Join-Path $tmp "lib\net462\Microsoft.Web.WebView2.WinForms.dll") $lib -Force
Copy-Item (Join-Path $tmp "runtimes\win-x64\native\WebView2Loader.dll")     $lib -Force
Write-Host "WebView2 SDK $ver -> $lib"
Get-ChildItem $lib | Select-Object Name
