// RawPrint.exe — spool a receipt to a named Windows printer as RAW ESC/POS bytes,
// with no dialog and no PowerShell. This is the fast path for cashier bill
// printing: a native console exe starts in ~100ms, versus ~1-2s to cold-start
// powershell.exe + print-text.ps1 on every bill. The backend calls this first
// and falls back to the PowerShell script only if the exe is missing.
//
//   RawPrint.exe "<PrinterName>" "<ReceiptFilePath>"
//
// Exit codes (kept in sync with print-text.ps1 so directPrint.js maps them the
// same): 0 ok, 2 file not found, 3 printer not installed/openable, 1 other error.
//
// Compiled with the in-box .NET Framework csc.exe (see build-app.ps1); needs no
// external packages.

using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

static class RawPrint
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct DOCINFO
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool OpenPrinter(string src, out IntPtr h, IntPtr pd);
    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool StartDocPrinter(IntPtr h, int level, ref DOCINFO di);
    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError = true)]
    static extern bool WritePrinter(IntPtr h, byte[] buf, int count, out int written);

    static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("usage: RawPrint.exe <PrinterName> <FilePath>");
            return 1;
        }
        string printer = args[0];
        string path = args[1];

        if (string.IsNullOrEmpty(printer))
        {
            Console.Error.WriteLine("No printer name given.");
            return 1;
        }
        if (!File.Exists(path))
        {
            Console.Error.WriteLine("Receipt file not found: " + path);
            return 2;
        }

        string text;
        try
        {
            // Auto-detects and strips the UTF-8 BOM the caller writes.
            text = File.ReadAllText(path, Encoding.UTF8);
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("Could not read receipt: " + e.Message);
            return 1;
        }
        text = text.Replace("\r\n", "\n");

        // ESC/POS: reset, the text, then feed two lines and partial-cut.
        string esc = ((char)27).ToString();
        string gs = ((char)29).ToString();
        string init = esc + "@";
        string cut = "\n\n" + gs + "V" + ((char)66).ToString() + ((char)0).ToString();
        string payload = init + text + cut;

        // ESC/POS wants bytes; one char -> one byte (Latin1/CP1252).
        byte[] data = Encoding.GetEncoding(28591).GetBytes(payload);

        IntPtr h;
        if (!OpenPrinter(printer, out h, IntPtr.Zero))
        {
            Console.Error.WriteLine("Printer not installed: " + printer);
            return 3;
        }
        try
        {
            DOCINFO di = new DOCINFO();
            di.pDocName = "InWallz Receipt";
            di.pDatatype = "RAW";
            if (!StartDocPrinter(h, 1, ref di)) { Console.Error.WriteLine("StartDocPrinter failed."); return 1; }
            if (!StartPagePrinter(h)) { Console.Error.WriteLine("StartPagePrinter failed."); return 1; }
            int written;
            bool ok = WritePrinter(h, data, data.Length, out written);
            EndPagePrinter(h);
            EndDocPrinter(h);
            if (!ok || written != data.Length) { Console.Error.WriteLine("WritePrinter incomplete."); return 1; }
        }
        finally
        {
            ClosePrinter(h);
        }
        return 0;
    }
}
