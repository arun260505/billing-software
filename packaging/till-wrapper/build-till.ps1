<#
  build-till.ps1 — compile InWallzTill.exe (the native WebView2 shell).

  Produces, in this folder:
    InWallzTill.exe
    Microsoft.Web.WebView2.Core.dll
    Microsoft.Web.WebView2.WinForms.dll
    WebView2Loader.dll
    app.ico
  All five ship together (the exe needs the DLLs next to it at runtime).

  Requires: the in-box .NET Framework compiler (csc.exe, always on Windows) and
  the WebView2 SDK DLLs already in .\lib (fetch-webview2.ps1 puts them there).
  The target machine needs the Evergreen WebView2 runtime (present on current
  Win10/11).
#>
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$csc  = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { throw "csc.exe not found (.NET Framework)." }

$core = Join-Path $here "lib\Microsoft.Web.WebView2.Core.dll"
$wf   = Join-Path $here "lib\Microsoft.Web.WebView2.WinForms.dll"
$loader = Join-Path $here "lib\WebView2Loader.dll"
foreach ($p in @($core, $wf, $loader)) { if (-not (Test-Path $p)) { throw "Missing SDK DLL: $p (run fetch-webview2.ps1)" } }

$exe = Join-Path $here "InWallzTill.exe"
& $csc /nologo /target:winexe /platform:x64 `
    ("/win32icon:" + (Join-Path $here "app.ico")) `
    ("/reference:" + $core) ("/reference:" + $wf) `
    ("/out:" + $exe) `
    (Join-Path $here "InWallzTill.cs")
if ($LASTEXITCODE -ne 0) { throw "csc failed ($LASTEXITCODE)" }

# Put the runtime DLLs next to the exe.
Copy-Item $core, $wf, $loader $here -Force
Write-Host "Built: $exe"
Get-Item $exe | Select-Object Name, @{n='KB';e={[math]::Round($_.Length/1KB)}}
