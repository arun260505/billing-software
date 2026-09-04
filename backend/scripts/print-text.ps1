# Spool a receipt to a named Windows printer as RAW bytes, with no dialog.
#
# Thermal receipt printers (TVS, Epson TM, etc.) are ESC/POS devices. Printing
# through the Windows GDI path (Out-Printer) renders a proportional font on a
# full driver PAGE - unclear text and a whole sheet fed per ticket. Instead we
# send the text straight to the spooler as RAW: the printer uses its own compact
# monospace font at the roll width, and we feed just a few lines and cut. No
# dialog, clear text, no wasted paper.
#
#   powershell -File print-text.ps1 -Path <file> -PrinterName "TVS RP 3160"

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
# into nothing - the cashier needs to know the bill did not come out.
$printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
if (-not $printer) {
    Write-Error "Printer not installed: $PrinterName"
    exit 3
}

# Read the receipt text (Get-Content -Raw strips the UTF-8 BOM the caller wrote).
$text = Get-Content -LiteralPath $Path -Raw
if ($null -eq $text) { $text = "" }
$text = $text -replace "`r`n", "`n"

# ESC/POS control codes.
$ESC = [char]27
$GS  = [char]29
$init   = "$ESC@"                                   # ESC @  - reset printer
# Feed a few lines so the content clears the cutter, then partial-cut.
# GS V 66 0  = feed (0) then partial cut. Widely supported on TVS/Epson clones.
$cut    = "`n`n`n`n" + "$GS" + "V" + [char]66 + [char]0

$payload = $init + $text + $cut

# One char -> one byte (Latin1/CP1252). ESC/POS wants bytes, not UTF-16, and the
# receipt text is ASCII ("Rs.", "=", "-", digits, letters).
$bytes = [System.Text.Encoding]::GetEncoding(28591).GetBytes($payload)

# RAW spool via the Windows print API (winspool), so no GDI page is rendered.
$code = @'
using System;
using System.Runtime.InteropServices;
public static class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
    }
    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string src, out IntPtr h, IntPtr pd);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr h, int level, ref DOCINFO di);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr h, byte[] buf, int count, out int written);

    public static void Send(string printer, byte[] data) {
        IntPtr h;
        if (!OpenPrinter(printer, out h, IntPtr.Zero))
            throw new Exception("OpenPrinter failed for " + printer);
        try {
            DOCINFO di = new DOCINFO();
            di.pDocName = "InWallz Receipt";
            di.pDatatype = "RAW";
            if (!StartDocPrinter(h, 1, ref di)) throw new Exception("StartDocPrinter failed.");
            if (!StartPagePrinter(h)) throw new Exception("StartPagePrinter failed.");
            int written;
            bool ok = WritePrinter(h, data, data.Length, out written);
            EndPagePrinter(h);
            EndDocPrinter(h);
            if (!ok || written != data.Length) throw new Exception("WritePrinter incomplete.");
        } finally {
            ClosePrinter(h);
        }
    }
}
'@
Add-Type -TypeDefinition $code -Language CSharp

[RawPrinter]::Send($PrinterName, $bytes)
exit 0
