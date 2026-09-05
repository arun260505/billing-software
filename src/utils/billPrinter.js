/**
 * Central Bill Formatter and Printer Utility
 * Dynamically formats and prints restaurant bills based on the saved bill_formats configuration.
 */

import { sanitizeCharges } from "./charges";
import { isParcelOrder } from "./kitchenPrinter";

export const DEFAULT_BILL_FORMAT = {
    paper_size: "thermal",
    show_logo: 0,
    show_restaurant_name: 1,
    show_address: 1,
    show_phone: 1,
    show_email: 0,
    show_gst: 1,
    show_fssai: 0,
    show_order_number: 1,
    show_date: 1,
    show_time: 1,
    show_table_name: 1,
    show_customer_name: 0,
    show_waiter_name: 0,
    show_cashier_name: 0,
    show_payment_method: 1,
    show_item_qty: 1,
    show_item_price: 1,
    show_subtotal: 1,
    show_tax: 1,
    show_service_charge: 1,
    show_charges: 1,
    show_grand_total: 1,
    header_title: "",
    footer_text: "Thank you! Visit again.",
    terms_text: ""
};

/**
 * Generate full HTML for bill preview and printing.
 */
export function generateBillHtml({ order = {}, restaurant = {}, format = {} }) {
    const cfg = { ...DEFAULT_BILL_FORMAT, ...format };
    const paperSize = cfg.paper_size || "thermal";

    const items = order.items || [];
    const subtotal = Number(order.subtotal || 0);
    const tax = Number(order.tax || order.gst || 0);
    const serviceCharge = Number(order.service_charge || order.serviceCharge || 0);
    const charges = sanitizeCharges(order.charges || order.selectedCharges);
    const chargesTotal = charges.reduce((sum, c) => {
        if (c.charge_type === "Percentage") return sum + Math.round(subtotal * Number(c.amount) / 100);
        return sum + Number(c.amount || 0);
    }, 0);
    const grandTotal = Number(order.grand_total || order.total || (subtotal + tax + serviceCharge + chargesTotal));

    const dateStr = order.date || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = order.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const orderNumber = order.order_number || "ORD-1001";
    const tableName = order.tableName || order.table_name || (order.table_number ? `Table ${order.table_number}` : "Counter");
    // The reference receipt labels the seat line by service type — "Dine In: 4"
    // for a table, "Take Away" for a counter bill — instead of a bare table name.
    const isParcel = isParcelOrder(order);
    const seatValue = order.table_number || String(tableName).replace(/^table\s*/i, "");
    const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 1), 0);
    const paymentMethod = order.payment_method || order.paymentMethod || "Cash";
    // Optional split-payment breakdown: array of { method, amount }.
    const paymentList = Array.isArray(order.payments) && order.payments.length
        ? order.payments
        : null;

    // Styles based on paper size
    const isA4 = paperSize === "a4";
    const is58mm = paperSize === "thermal-58";

    const fontStyle = isA4
        ? "font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.4; word-break: break-word;"
        : "font-family: 'Courier New', Courier, monospace; color: #000; line-height: 1.3; word-break: break-word;";

    const containerStyle = isA4
        ? "max-width: 760px; margin: 0 auto; padding: 32px; background: #fff;"
        : is58mm
            ? "max-width: 230px; margin: 0 auto; padding: 8px 4px; font-size: 11px; background: #fff;"
            : "max-width: 320px; margin: 0 auto; padding: 14px 8px; font-size: 13px; background: #fff;";

    const divider = isA4
        ? `<div style="border-bottom: 1px solid #cbd5e1; margin: 16px 0;"></div>`
        : `<div style="border-top: 1px dashed #475569; margin: 8px 0;"></div>`;

    // ── 1. HEADER SECTION ──────────────────────────────────
    let headerHtml = `<div style="text-align: center; margin-bottom: 10px;">`;

    if (cfg.show_logo && restaurant.logo && typeof restaurant.logo === "string" && restaurant.logo.trim()) {
        headerHtml += `<img src="${restaurant.logo}" alt="Logo" style="max-height: ${isA4 ? "70px" : is58mm ? "42px" : "52px"}; max-width: 100%; object-fit: contain; display: block; margin: 0 auto 6px;" />`;
    }

    if (cfg.header_title && cfg.header_title.trim()) {
        headerHtml += `<div style="font-size: ${isA4 ? "14px" : "12px"}; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">${escapeHtml(cfg.header_title)}</div>`;
    }

    if (cfg.show_restaurant_name) {
        const rName = restaurant.restaurant_name || "Restaurant";
        headerHtml += `<h2 style="margin: 0 0 2px; font-size: ${isA4 ? "24px" : is58mm ? "15px" : "18px"}; font-weight: bold; text-transform: uppercase; line-height: 1.2;">${escapeHtml(rName)}</h2>`;
    }

    // GSTIN sits directly under the trading name, the way the printed reference
    // bill reads it — identity block first, then the postal address.
    if (cfg.show_gst && restaurant.gst_number && String(restaurant.gst_number).trim()) {
        headerHtml += `<div style="font-size: ${isA4 ? "12px" : "11px"}; font-weight: 600; margin-bottom: 4px;">${isA4 ? "GSTIN: " : ""}${escapeHtml(restaurant.gst_number)}</div>`;
    }

    const addrParts = [restaurant.address, restaurant.city, restaurant.state, restaurant.pincode].filter((p) => p && String(p).trim());
    if (cfg.show_address && addrParts.length > 0) {
        headerHtml += `<div style="font-size: ${isA4 ? "12px" : "11px"}; font-weight: ${isA4 ? "400" : "600"}; color: ${isA4 ? "#475569" : "#111"}; margin-bottom: 2px;">${escapeHtml(addrParts.join(", "))}</div>`;
    }

    if (cfg.show_phone && restaurant.mobile && String(restaurant.mobile).trim()) {
        headerHtml += `<div style="font-size: ${isA4 ? "12px" : "11px"};">Ph: ${escapeHtml(restaurant.mobile)}</div>`;
    }

    if (cfg.show_email && restaurant.email && String(restaurant.email).trim()) {
        headerHtml += `<div style="font-size: ${isA4 ? "12px" : "11px"};">Email: ${escapeHtml(restaurant.email)}</div>`;
    }

    if (cfg.show_fssai && restaurant.fssai_number && String(restaurant.fssai_number).trim()) {
        headerHtml += `<div style="font-size: ${isA4 ? "12px" : "11px"};">FSSAI: ${escapeHtml(restaurant.fssai_number)}</div>`;
    }

    headerHtml += `</div>`;

    // ── 2. ORDER META SECTION ──────────────────────────────
    // Customer name gets its own full-width line above the rest, and prints as a
    // blank rule when the bill has no name on it — the counter staff writes it in.
    let metaHtml = "";
    if (cfg.show_customer_name) {
        metaHtml += `
            <div style="font-size: ${isA4 ? "13px" : is58mm ? "10px" : "11px"}; padding-bottom: 3px; margin-bottom: 4px; border-bottom: 1px dashed #000;">
                Name: ${order.customer_name ? escapeHtml(order.customer_name) : ""}
            </div>
        `;
    }

    metaHtml += `<div style="font-size: ${isA4 ? "13px" : is58mm ? "10px" : "11px"}; margin-bottom: 8px;">`;

    // Paired left/right the way the reference bill reads: Date | Dine In,
    // Cashier | Bill No. Anything switched off simply drops out of the pairing.
    const metaRows = [];
    if (cfg.show_date) metaRows.push(`<strong>Date:</strong> ${dateStr}`);
    if (cfg.show_table_name) metaRows.push(isParcel ? `<strong>Take Away</strong>` : `<strong>Dine In:</strong> ${escapeHtml(seatValue)}`);
    if (cfg.show_time) metaRows.push(`<strong>Time:</strong> ${timeStr}`);
    if (cfg.show_waiter_name && (order.waiter_name || order.waiter)) metaRows.push(`<strong>Waiter:</strong> ${escapeHtml(order.waiter_name || order.waiter)}`);
    if (cfg.show_cashier_name && (order.cashier_name || order.cashier)) metaRows.push(`<strong>Cashier:</strong> ${escapeHtml(order.cashier_name || order.cashier)}`);
    if (cfg.show_order_number) metaRows.push(`<strong>Bill No.:</strong> ${escapeHtml(orderNumber)}`);

    if (isA4) {
        metaHtml += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">`;
        metaRows.forEach((r) => { metaHtml += `<div>${r}</div>`; });
        metaHtml += `</div>`;
    } else {
        for (let i = 0; i < metaRows.length; i += 2) {
            metaHtml += `<div style="display: flex; margin-bottom: 2px;">`;
            metaHtml += `<div style="width: 52%;">${metaRows[i]}</div>`;
            metaHtml += `<div style="width: 48%;">${metaRows[i + 1] || ""}</div>`;
            metaHtml += `</div>`;
        }
    }
    metaHtml += `</div>`;

    // ── 3. ITEMS TABLE ─────────────────────────────────────
    let itemsHtml = "";
    if (isA4) {
        itemsHtml += `
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
                <thead>
                    <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                        <th style="padding: 8px 10px; width: 40px;">No.</th>
                        <th style="padding: 8px 10px;">Item</th>
                        ${cfg.show_item_qty ? `<th style="padding: 8px 10px; text-align: center; width: 70px;">Qty.</th>` : ""}
                        ${cfg.show_item_price ? `<th style="padding: 8px 10px; text-align: right; width: 90px;">Price</th>` : ""}
                        <th style="padding: 8px 10px; text-align: right; width: 100px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
        `;
        items.forEach((it, idx) => {
            const lineTotal = (Number(it.price || 0) * Number(it.quantity || 1)).toFixed(2);
            itemsHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 10px; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 8px 10px; font-weight: 500;">${escapeHtml(it.item_name)}${it.notes ? `<br><small style="color:#64748b;font-style:italic;">Note: ${escapeHtml(it.notes)}</small>` : ""}</td>
                    ${cfg.show_item_qty ? `<td style="padding: 8px 10px; text-align: center;">${it.quantity}</td>` : ""}
                    ${cfg.show_item_price ? `<td style="padding: 8px 10px; text-align: right;">${Number(it.price).toFixed(2)}</td>` : ""}
                    <td style="padding: 8px 10px; text-align: right; font-weight: 600;">${lineTotal}</td>
                </tr>
            `;
        });
        itemsHtml += `</tbody></table>`;
    } else {
        // No. | Item | Qty. | Price | Amount — line numbers lead and the rupee
        // symbol is dropped from the columns, so the figures stay aligned on a
        // narrow roll and only the grand total carries the currency mark.
        const noW = is58mm ? "16px" : "20px";
        const qtyW = is58mm ? "24px" : "28px";
        const priceW = is58mm ? "42px" : "50px";
        const amtW = is58mm ? "46px" : "56px";

        itemsHtml += `<div style="margin: 6px 0;">`;
        itemsHtml += `
            <div style="display: flex; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin-bottom: 4px; font-size: ${is58mm ? "10px" : "11px"};">
                <span style="width: ${noW};">No.</span>
                <span style="flex: 1; padding-right: 4px;">Item</span>
                ${cfg.show_item_qty ? `<span style="width: ${qtyW}; text-align: right;">Qty.</span>` : ""}
                ${cfg.show_item_price ? `<span style="width: ${priceW}; text-align: right;">Price</span>` : ""}
                <span style="width: ${amtW}; text-align: right;">Amount</span>
            </div>
        `;
        items.forEach((it, idx) => {
            // Two decimals, matching the A4 renderer above and the totals the
            // backend stores. The thermal branch rounded every line and the
            // grand total to whole rupees, so the receipt a customer is actually
            // handed did not add up — and disagreed with the A4 invoice for the
            // same bill.
            const lineTotal = (Number(it.price || 0) * Number(it.quantity || 1)).toFixed(2);
            itemsHtml += `
                <div style="display: flex; align-items: flex-start; margin-bottom: 3px; font-size: ${is58mm ? "10px" : "12px"};">
                    <span style="width: ${noW};">${idx + 1}</span>
                    <span style="flex: 1; padding-right: 4px; white-space: normal;">${escapeHtml(it.item_name)}</span>
                    ${cfg.show_item_qty ? `<span style="width: ${qtyW}; text-align: right;">${it.quantity}</span>` : ""}
                    ${cfg.show_item_price ? `<span style="width: ${priceW}; text-align: right;">${Number(it.price || 0).toFixed(2)}</span>` : ""}
                    <span style="width: ${amtW}; text-align: right; font-weight: 600;">${lineTotal}</span>
                </div>
            `;
            if (it.notes) {
                itemsHtml += `<div style="font-size: 9px; font-style: italic; color: #555; padding-left: ${noW}; margin-bottom: 2px;">* ${escapeHtml(it.notes)}</div>`;
            }
        });
        itemsHtml += `</div>`;
    }

    // ── 4. SUMMARY SECTION ─────────────────────────────────
    // Totals are two decimals on every paper size. Percentages are derived from
    // the amounts the bill actually carries, so a restaurant on 12% GST prints
    // "GST 12%" without any extra field having to be plumbed through.
    let summaryHtml = "";
    const summaryRows = [];

    if (cfg.show_subtotal) {
        summaryRows.push({ label: "Sub Total", val: subtotal.toFixed(2) });
    }
    if (cfg.show_tax && tax > 0) {
        summaryRows.push({ label: `GST${percentOf(tax, subtotal)}`, val: tax.toFixed(2) });
    }
    if (cfg.show_service_charge && serviceCharge > 0) {
        summaryRows.push({ label: `Service Charge${percentOf(serviceCharge, subtotal)}`, val: serviceCharge.toFixed(2) });
    }

    if (cfg.show_charges && charges.length > 0) {
        charges.forEach((c) => {
            const val = c.charge_type === "Percentage"
                ? Math.round(subtotal * Number(c.amount) / 100)
                : Number(c.amount);
            const label = c.charge_type === "Percentage" ? `${c.charge_name} ${Number(c.amount)}%` : c.charge_name;
            summaryRows.push({ label, val: val.toFixed(2) });
        });
    }

    const qtyLine = cfg.show_item_qty ? `Total Qty: ${totalQty}` : "";

    if (isA4) {
        summaryHtml += `<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 12px;">`;
        summaryHtml += `<div style="font-size: 13px; font-weight: 600; color: #475569;">${qtyLine}</div>`;
        summaryHtml += `<div style="width: 300px; font-size: 13px;">`;
        summaryRows.forEach((r) => {
            summaryHtml += `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9;"><span>${escapeHtml(r.label)}</span><span>${r.val}</span></div>`;
        });
        if (cfg.show_grand_total) {
            summaryHtml += `<div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; font-weight: bold; border-top: 2px solid #0f172a; margin-top: 4px;"><span>Grand Total</span><span>&#8377;${grandTotal.toFixed(2)}</span></div>`;
        }
        summaryHtml += `</div></div>`;
    } else {
        // Quantity sits to the left of the money column, as on the reference bill.
        summaryHtml += divider;
        summaryHtml += `<div style="display: flex; justify-content: space-between; font-size: ${is58mm ? "10px" : "12px"};">`;
        summaryHtml += `<div style="font-weight: 600; padding-top: 1px;">${qtyLine}</div>`;
        summaryHtml += `<div style="min-width: ${is58mm ? "120px" : "150px"};">`;
        summaryRows.forEach((r) => {
            summaryHtml += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="padding-right: 8px;">${escapeHtml(r.label)}</span><span>${r.val}</span></div>`;
        });
        summaryHtml += `</div></div>`;

        if (cfg.show_grand_total) {
            summaryHtml += `
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${is58mm ? "12px" : "14px"}; margin-top: 4px; padding: 4px 0; border-top: 1px solid #000; border-bottom: 1px solid #000;">
                    <span>Grand Total</span><span>&#8377;${grandTotal.toFixed(2)}</span>
                </div>
            `;
        }
    }

    // ── 5. PAYMENT SECTION ─────────────────────────────────
    let paymentHtml = "";
    if (cfg.show_payment_method) {
        if (paymentList && paymentList.length > 1) {
            // Split payment — show each method with its amount.
            const rowsHtml = paymentList.map((p) => `
                <div style="display: flex; justify-content: space-between; margin-top: 3px;">
                    <span>${escapeHtml(p.method || "Cash")}</span>
                    <span>₹${Number(p.amount || 0).toFixed(2)}</span>
                </div>
            `).join("");
            paymentHtml = `
                <div style="margin-top: 6px; font-size: ${isA4 ? "12px" : is58mm ? "10px" : "11px"}; font-weight: 500;">
                    <div style="font-weight: 600;">Payment Split:</div>
                    ${rowsHtml}
                </div>
            `;
        } else {
            paymentHtml += `
                <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: ${isA4 ? "12px" : is58mm ? "10px" : "11px"}; font-weight: 500;">
                    <span>Payment Mode:</span>
                    <span>${escapeHtml(paymentMethod)}</span>
                </div>
            `;
        }
    }

    // ── 6. FOOTER & TERMS ──────────────────────────────────
    let footerHtml = `<div style="text-align: center; margin-top: 14px; font-size: ${isA4 ? "12px" : "11px"};">`;
    if (cfg.footer_text && cfg.footer_text.trim()) {
        footerHtml += `<div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(cfg.footer_text)}</div>`;
    }
    if (cfg.terms_text && cfg.terms_text.trim()) {
        footerHtml += `<div style="font-size: ${isA4 ? "10px" : "9px"}; color: #64748b; white-space: pre-wrap; margin-top: 6px;">${escapeHtml(cfg.terms_text)}</div>`;
    }
    footerHtml += `</div>`;

    return `
        <div style="${fontStyle} ${containerStyle}">
            ${headerHtml}
            ${divider}
            ${metaHtml}
            ${itemsHtml}
            ${summaryHtml}
            ${paymentHtml}
            ${divider}
            ${footerHtml}
        </div>
    `;
}

/**
 * Trigger browser print popup using the formatted bill HTML.
 */
export function printBill({ order = {}, restaurant = {}, format = {} }) {
    const cfg = { ...DEFAULT_BILL_FORMAT, ...format };
    const paperSize = cfg.paper_size || "thermal";

    const width = paperSize === "a4" ? 820 : paperSize === "thermal-58" ? 280 : 360;
    const height = paperSize === "a4" ? 900 : 650;

    const printContent = generateBillHtml({ order, restaurant, format: cfg });

    const w = window.open("", "PrintBill", `width=${width},height=${height},toolbar=0,scrollbars=1,status=0`);
    if (!w) {
        alert("Print window was blocked by browser. Please allow popups for this site to print bills.");
        return false;
    }

    w.document.open();
    w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bill - ${escapeHtml(order.order_number || "Receipt")}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
                @page {
                    size: ${paperSize === "a4" ? "A4 portrait" : "auto"};
                    margin: ${paperSize === "a4" ? "12mm" : "0"};
                }
                body {
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                * {
                    box-sizing: border-box;
                }
                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                    }
                }
            </style>
        </head>
        <body>
            ${printContent}
        </body>
        </html>
    `);
    w.document.close();
    w.focus();

    // Small timeout ensures styles and images load before print dialog opens
    setTimeout(() => {
        try {
            w.print();
        } catch (e) {
            console.error("Print invocation error:", e);
        }
    }, 250);

    return true;
}

/**
 * " 5%" for a line worth 5% of the subtotal, "" when it cannot be expressed as
 * one. Used to label GST and percentage charges on the printed bill.
 */
function percentOf(part, base) {
    if (!(Number(base) > 0) || !(Number(part) > 0)) return "";
    const p = Math.round((Number(part) / Number(base)) * 10000) / 100;
    if (!(p > 0)) return "";
    return ` ${Number.isInteger(p) ? p : p.toFixed(2)}%`;
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const billPrinter = {
    DEFAULT_BILL_FORMAT,
    generateBillHtml,
    printBill
};

export default billPrinter;
