/**
 * A one-off test slip the cashier prints from the Printer page to confirm a
 * printer is really wired up and loaded with paper.
 *
 * The browser's print dialog picks the device, so the printer name is stamped on
 * the slip: whoever is standing at the printer can see which one it was meant
 * for. It is deliberately short — a few lines of thermal paper, not a full bill.
 */

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function printTestSlip({ printerName = "", role = "", restaurantName = "" } = {}) {

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const body = `
        <div style="font-family:'Courier New',Courier,monospace;color:#000;max-width:300px;margin:0 auto;padding:14px 8px;font-size:13px;line-height:1.4;">
            <div style="text-align:center;font-weight:900;font-size:15px;letter-spacing:1px;border-bottom:2px solid #000;padding-bottom:6px;">
                PRINTER TEST
            </div>

            ${restaurantName ? `<div style="text-align:center;font-weight:bold;text-transform:uppercase;margin-top:6px;">${escapeHtml(restaurantName)}</div>` : ""}

            <div style="margin:10px 0;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:8px 0;">
                <div style="display:flex;justify-content:space-between;"><span>Printer:</span><span style="font-weight:bold;">${escapeHtml(printerName || "(not set)")}</span></div>
                ${role ? `<div style="display:flex;justify-content:space-between;"><span>Prints:</span><span>${escapeHtml(role)}</span></div>` : ""}
                <div style="display:flex;justify-content:space-between;"><span>Date:</span><span>${escapeHtml(dateStr)}</span></div>
                <div style="display:flex;justify-content:space-between;"><span>Time:</span><span>${escapeHtml(timeStr)}</span></div>
            </div>

            <div style="text-align:center;font-weight:bold;">
                If you can read this, the printer works.
            </div>

            <div style="text-align:center;margin-top:10px;font-size:11px;border-top:1px dashed #000;padding-top:6px;">
                InWallz POS
            </div>
        </div>
    `;

    const w = window.open("", "PrintTest", "width=360,height=520,toolbar=0,scrollbars=1,status=0");
    if (!w) {
        alert("Print window was blocked by the browser. Please allow popups to run a test print.");
        return false;
    }

    w.document.open();
    w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Printer Test${printerName ? ` — ${escapeHtml(printerName)}` : ""}</title>
            <meta charset="utf-8" />
            <style>
                @page { size: auto; margin: 0; }
                body { margin: 0; padding: 0; background: #fff; }
                * { box-sizing: border-box; }
            </style>
        </head>
        <body>${body}</body>
        </html>
    `);
    w.document.close();
    w.focus();

    setTimeout(() => {
        try {
            w.print();
        } catch (e) {
            console.error("Test print invocation error:", e);
        }
    }, 250);

    return true;
}

const testPrint = { printTestSlip };

export default testPrint;
