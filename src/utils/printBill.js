// One receipt printer, used for the first print and every reprint, so a
// corrected bill can never come out looking different from the original.

import { sanitizeCharges } from "./charges";

const rupees = (n) => `&#8377;${Number(n || 0).toFixed(2)}`;

const row = (label, value, bold) =>
    `<div style="display:flex;justify-content:space-between${bold ? ";font-weight:bold;font-size:15px" : ""}">
        <span>${label}</span><span>${value}</span>
     </div>`;

/**
 * Open the print dialog for a bill.
 *
 * @param {object}  bill
 * @param {string}  bill.title        Restaurant name shown at the top
 * @param {string}  bill.billNumber
 * @param {string}  bill.place        "Table 3" / "Counter"
 * @param {Array}   bill.items        [{ item_name, quantity, price }]
 * @param {number}  bill.subtotal
 * @param {Array}   bill.taxLines     [{ charge_name, amount }] GST / service, already in rupees
 * @param {Array}   bill.charges      [{ charge_name, amount }] already resolved to rupees
 * @param {number}  bill.total
 * @param {string}  bill.method       Payment method
 * @param {boolean} bill.isReprint    Stamps the receipt as a corrected reprint
 * @returns {boolean} false if the browser blocked the popup
 */
export function printBill({
    title = "InWallz",
    billNumber = "",
    place = "",
    items = [],
    subtotal = 0,
    taxLines = [],
    charges = [],
    total = 0,
    method = "",
    isReprint = false
}) {

    // The tax and service lines were "GST 5%" and "Service 2%" hardcoded here,
    // so a reprint at any other rate — or at a restaurant charging no tax at
    // all — printed figures that did not match the bill being corrected. They
    // are the restaurant's own charge rows now, and print by their own names.
    taxLines = sanitizeCharges(taxLines);
    charges = sanitizeCharges(charges);

    const w = window.open("", "PrintBill", "width=340,height=640");
    if (!w) return false;

    const when = new Date().toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });

    w.document.write(
        `<div style="font-family:monospace;padding:12px;font-size:13px">
            <h3 style="text-align:center;margin:0">${title}</h3>
            <p style="text-align:center;margin:2px 0 6px">${place}</p>` +

        (isReprint
            ? `<p style="text-align:center;margin:0 0 6px;padding:4px;border:1px dashed #000;font-weight:bold">
                   ** REPRINT &mdash; CORRECTED BILL **
               </p>`
            : "") +

        `<div style="display:flex;justify-content:space-between;font-size:11px">
            <span>${billNumber}</span><span>${when}</span>
         </div>
         <hr>` +

        items.map((i) =>
            `<div style="display:flex;justify-content:space-between">
                <span>${i.item_name} x${Number(i.quantity)}</span>
                <span>${rupees(Number(i.price) * Number(i.quantity))}</span>
             </div>`
        ).join("") +

        `<hr>` +
        row("Subtotal", rupees(subtotal)) +
        taxLines.map((t) => row(t.charge_name, rupees(t.amount))).join("") +

        // Optional per-bill charges (packing, delivery, …). When present the
        // receipt shows what the bill came to BEFORE them, so the customer can
        // see what was added on top.
        (charges.length > 0
            ? `<hr>` +
              row("Bill Amount", rupees(
                  Number(subtotal) + taxLines.reduce((s, t) => s + Number(t.amount || 0), 0)
              )) +
              `<div style="margin-top:6px;font-weight:bold">Charges</div>` +
              charges.map((c) =>
                  `<div style="display:flex;justify-content:space-between;padding-left:10px">
                      <span>${c.charge_name}</span><span>${rupees(c.amount)}</span>
                   </div>`
              ).join("") +
              row("Total Charges", rupees(charges.reduce((s, c) => s + Number(c.amount || 0), 0)))
            : "") +

        `<hr>` +
        row("TOTAL", rupees(total), true) +
        (method ? row("Paid via", method) : "") +

        `<p style="text-align:center;margin-top:12px">Thank you!</p>
         </div>`
    );

    w.document.close();
    w.focus();
    w.print();

    return true;

}
