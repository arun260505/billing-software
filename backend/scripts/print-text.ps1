# Spool a text file to a named Windows printer, with no dialog.
#
# Called by backend/utils/directPrint.js via execFile, so the arguments arrive as
# a real argv array — PowerShell binds them to these params and nothing is passed
# through a shell. That is what keeps a printer name containing spaces, quotes or
# ampersands from being interpreted.
#
#   powershell -File print-text.ps1 -Path <file> -PrinterName "EPSON TM-T82"

param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$PrinterName
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Path)) {
    Write-Error "Receipt file not found: $Path"
    exit 2
}

# Fail loudly when the printer is not installed, rather than silently spooling
# into nothing — the cashier needs to know the bill did not come out.
$printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
if (-not $printer) {
    Write-Error "Printer not installed: $PrinterName"
    exit 3
}

Get-Content -LiteralPath $Path -Raw | Out-Printer -Name $PrinterName
exit 0
