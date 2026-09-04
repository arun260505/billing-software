const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

/*
|--------------------------------------------------------------------------
| Direct (dialog-free) printing
|--------------------------------------------------------------------------
| A browser can never print without showing its dialog, so the cashier screen
| hands the finished receipt text to this node instead and we spool it straight
| to a named Windows printer.
|
| This only works when the backend runs ON the till — the exe/local node. A
| cloud (Linux) node reports that it cannot print and the caller falls back to
| the browser dialog.
*/

const SCRIPT = path.join(__dirname, "..", "scripts", "print-text.ps1");

// A receipt is a few hundred bytes; this cap just stops a malformed request
// from writing something huge to disk.
const MAX_TEXT_BYTES = 200 * 1024;

function canPrint() {
    return process.platform === "win32";
}

/**
 * Spool `text` to `printerName`. Callback gets (err) — err.userMessage carries a
 * line that is safe and useful to show a cashier.
 */
function printText(printerName, text, callback) {

    if (!canPrint()) {
        const err = new Error(`Direct printing needs a Windows till (this server is ${process.platform}).`);
        err.userMessage = "This server cannot print directly — it is not the till PC.";
        err.code = "NOT_SUPPORTED";
        return callback(err);
    }

    const name = String(printerName || "").trim();
    if (!name) {
        const err = new Error("No printer name given.");
        err.userMessage = "No printer is set for this receipt.";
        err.code = "NO_PRINTER";
        return callback(err);
    }

    const body = String(text == null ? "" : text);
    if (!body.trim()) {
        const err = new Error("Nothing to print.");
        err.userMessage = "There was nothing to print.";
        err.code = "EMPTY";
        return callback(err);
    }
    if (Buffer.byteLength(body, "utf8") > MAX_TEXT_BYTES) {
        const err = new Error("Receipt too large.");
        err.userMessage = "That receipt is too large to print.";
        err.code = "TOO_LARGE";
        return callback(err);
    }

    const file = path.join(
        os.tmpdir(),
        `inwallz-receipt-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.txt`
    );

    // Thermal drivers on Windows read the spooled text as ANSI/OEM unless told
    // otherwise; a BOM keeps PowerShell reading it back as UTF-8.
    fs.writeFile(file, "﻿" + body, { encoding: "utf8" }, (writeErr) => {
        if (writeErr) {
            writeErr.userMessage = "Could not prepare the receipt for printing.";
            return callback(writeErr);
        }

        const cleanup = () => fs.unlink(file, () => {});

        execFile(
            "powershell.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy", "Bypass",
                "-File", SCRIPT,
                "-Path", file,
                "-PrinterName", name
            ],
            { timeout: 25000, windowsHide: true, maxBuffer: 1024 * 512 },
            (err, stdout, stderr) => {
                cleanup();

                if (err) {
                    const detail = String(stderr || err.message || "").trim();
                    // Exit 3 is the script's "printer not installed" signal.
                    if (err.code === 3 || /not installed/i.test(detail)) {
                        err.userMessage = `Printer "${name}" is not installed on this PC.`;
                        err.code = "PRINTER_MISSING";
                    } else if (err.killed) {
                        err.userMessage = `Printing to "${name}" timed out — is it switched on?`;
                        err.code = "TIMEOUT";
                    } else {
                        err.userMessage = `Windows could not print to "${name}".`;
                    }
                    err.detail = detail;
                    return callback(err);
                }

                callback(null, { printer: name });
            }
        );
    });
}

module.exports = { canPrint, printText, MAX_TEXT_BYTES };
