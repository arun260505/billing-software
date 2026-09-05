/**
 * Central Kitchen Order Ticket (KOT) Formatter and Printer Utility
 * Dynamically formats and prints Kitchen Order Tickets based on the saved kitchen_formats configuration.
 * Strictly decoupled from customer billing.
 */

export const DEFAULT_KITCHEN_FORMAT = {
    paper_size: "thermal",
    show_logo: 0,
    show_restaurant_name: 1,
    show_address: 0,
    show_phone: 0,
    show_order_number: 1,
    show_date: 1,
    show_time: 1,
    show_order_type: 1,
    show_table_name: 1,
    show_customer_name: 0,
    show_waiter_name: 1,
    show_cashier_name: 0,
    show_item_qty: 1,
    show_item_name: 1,
    show_item_notes: 1,
    show_item_category: 0,
    header_title: "KITCHEN ORDER TICKET",
    footer_text: "Please prepare carefully."
};

/**
 * Helper to identify if an order is parcel/takeaway.
 */
export function isParcelOrder(order = {}) {
    if (order.isParcel) return true;
    const type = String(order.order_type || "").toLowerCase();
    if (type === "takeaway" || type === "parcel" || type === "delivery") return true;
    if (order.tableName && String(order.tableName).toLowerCase().includes("counter")) return true;
    if (!order.table_id && !order.table_number && !order.tableName) return true;
    return false;
}

/**
 * Generate full HTML for KOT preview and thermal printing.
 */
export function generateKitchenTicketHtml({ order = {}, restaurant = {}, format = {} }) {
    const cfg = { ...DEFAULT_KITCHEN_FORMAT, ...format };
    const is58mm = cfg.paper_size === "thermal-58";

    const items = order.items || [];
    const dateStr = order.date || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = order.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const orderNumber = order.order_number || "ORD-1024";

    const isParcel = isParcelOrder(order);
    const tableName = isParcel
        ? "PARCEL / TAKEAWAY"
        : (order.tableName || order.table_name || (order.table_number ? `Table ${order.table_number}` : "Dine-In"));

    const fontStyle = "font-family: 'Courier New', Courier, monospace; color: #000; line-height: 1.3; word-break: break-word;";
    const containerStyle = is58mm
        ? "max-width: 230px; margin: 0 auto; padding: 8px 4px; font-size: 11px; background: #fff;"
        : "max-width: 320px; margin: 0 auto; padding: 14px 8px; font-size: 13px; background: #fff;";

    const heavyDivider = `<div style="border-top: 2px solid #000; margin: 8px 0;"></div>`;
    const dashedDivider = `<div style="border-top: 1px dashed #000; margin: 6px 0;"></div>`;
    const doubleDivider = `<div style="border-top: 3px double #000; margin: 8px 0;"></div>`;

    // ── 1. HEADER SECTION ──────────────────────────────────
    let headerHtml = `<div style="text-align: center; margin-bottom: 6px;">`;

    if (cfg.show_logo && restaurant.logo && typeof restaurant.logo === "string" && restaurant.logo.trim()) {
        headerHtml += `<img src="${restaurant.logo}" alt="Logo" style="max-height: ${is58mm ? "36px" : "48px"}; max-width: 100%; object-fit: contain; display: block; margin: 0 auto 4px;" />`;
    }

    if (cfg.header_title && cfg.header_title.trim()) {
        headerHtml += `<div style="font-size: ${is58mm ? "13px" : "15px"}; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; border-bottom: 1px solid #000; padding-bottom: 2px; display: inline-block;">${escapeHtml(cfg.header_title)}</div>`;
    }

    if (cfg.show_restaurant_name) {
        const rName = restaurant.restaurant_name || "Restaurant";
        headerHtml += `<div style="font-size: ${is58mm ? "12px" : "14px"}; font-weight: bold; text-transform: uppercase; margin-top: 2px;">${escapeHtml(rName)}</div>`;
    }

    const addrParts = [restaurant.address, restaurant.city].filter((p) => p && String(p).trim());
    if (cfg.show_address && addrParts.length > 0) {
        headerHtml += `<div style="font-size: ${is58mm ? "9px" : "11px"}; color: #222; margin-top: 1px;">${escapeHtml(addrParts.join(", "))}</div>`;
    }

    if (cfg.show_phone && restaurant.mobile && String(restaurant.mobile).trim()) {
        headerHtml += `<div style="font-size: ${is58mm ? "9px" : "11px"};">Ph: ${escapeHtml(restaurant.mobile)}</div>`;
    }

    headerHtml += `</div>`;

    // ── 2. ORDER TYPE HIGHLIGHT BANNER (MONOCHROME OPTIMIZED) ─────────────
    // Dine-in gets the same boxed banner as parcel — the table number is the
    // one thing a cook has to read across the pass, and it used to be buried in
    // a small grey metadata row while takeaway got the whole box.
    const bannerTitle = isParcel
        ? "*** PARCEL ***"
        : (cfg.show_table_name ? `*** ${String(tableName).toUpperCase()} ***` : "*** DINE-IN ***");
    const bannerSubtitle = isParcel ? "[ TAKEAWAY PACKING ]" : "[ DINE - IN ]";

    const orderTypeBannerHtml = `
        <div style="border: 2px solid #000; padding: ${is58mm ? "4px 2px" : "6px 4px"}; margin: 6px 0; text-align: center; background: #fff;">
            <div style="font-size: ${is58mm ? "14px" : "17px"}; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; line-height: 1.1;">
                ${escapeHtml(bannerTitle)}
            </div>
            <div style="font-size: ${is58mm ? "9px" : "11px"}; font-weight: bold; letter-spacing: 1px; margin-top: 2px;">
                ${bannerSubtitle}
            </div>
        </div>
    `;

    // ── 3. ORDER METADATA ──────────────────────────────────
    let metaHtml = `<div style="font-size: ${is58mm ? "10px" : "12px"}; margin: 4px 0;">`;
    const metaRows = [];

    if (cfg.show_order_number) {
        metaRows.push(`<div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${is58mm ? "11px" : "13px"};"><span>KOT / ORD:</span><span>#${escapeHtml(orderNumber)}</span></div>`);
    }

    if (cfg.show_order_type) {
        metaRows.push(`<div style="display: flex; justify-content: space-between;"><span>Type:</span><span style="font-weight: bold; text-transform: uppercase;">${isParcel ? "PARCEL / TAKEAWAY" : "DINE-IN"}</span></div>`);
    }

    const dtParts = [];
    if (cfg.show_date) dtParts.push(dateStr);
    if (cfg.show_time) dtParts.push(timeStr);
    if (dtParts.length > 0) {
        metaRows.push(`<div style="display: flex; justify-content: space-between;"><span>Time:</span><span>${escapeHtml(dtParts.join(" | "))}</span></div>`);
    }

    if (cfg.show_waiter_name && (order.waiter_name || order.waiter)) {
        metaRows.push(`<div style="display: flex; justify-content: space-between;"><span>Server / Waiter:</span><span>${escapeHtml(order.waiter_name || order.waiter)}</span></div>`);
    }

    if (cfg.show_cashier_name && (order.cashier_name || order.cashier)) {
        metaRows.push(`<div style="display: flex; justify-content: space-between;"><span>Cashier:</span><span>${escapeHtml(order.cashier_name || order.cashier)}</span></div>`);
    }

    if (cfg.show_customer_name && order.customer_name) {
        metaRows.push(`<div style="display: flex; justify-content: space-between;"><span>Customer:</span><span>${escapeHtml(order.customer_name)}</span></div>`);
    }

    metaHtml += metaRows.join("");
    metaHtml += `</div>`;

    // ── 4. KITCHEN ITEMS TABLE ─────────────────────────────
    let itemsHtml = `
        <div style="margin: 6px 0;">
            <div style="display: flex; justify-content: space-between; font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 4px; font-size: ${is58mm ? "11px" : "13px"}; text-transform: uppercase;">
                ${cfg.show_item_qty ? `<span style="width: ${is58mm ? "36px" : "46px"}; text-align: left;">QTY</span>` : ""}
                <span style="flex: 1; text-align: left; padding-left: 4px;">ITEM DESCRIPTION</span>
            </div>
    `;

    items.forEach((it, idx) => {
        const qty = it.quantity || 1;
        const name = it.item_name || it.name || "Item";
        const notes = it.notes || it.note || "";
        const category = it.category_name || it.category || "";

        itemsHtml += `
            <div style="border-bottom: 1px dashed #ccc; padding: 5px 0;">
                <div style="display: flex; align-items: flex-start;">
                    ${cfg.show_item_qty ? `<span style="width: ${is58mm ? "36px" : "46px"}; font-size: ${is58mm ? "13px" : "15px"}; font-weight: 900; text-align: left; line-height: 1.2;">${qty}x</span>` : ""}
                    <div style="flex: 1; padding-left: 4px;">
                        ${cfg.show_item_category && category ? `<div style="font-size: 9px; text-transform: uppercase; color: #555;">[${escapeHtml(category)}]</div>` : ""}
                        ${cfg.show_item_name ? `<div style="font-size: ${is58mm ? "12px" : "14px"}; font-weight: bold; line-height: 1.2;">${escapeHtml(name)}</div>` : ""}
                        ${cfg.show_item_notes && notes ? `<div style="font-size: ${is58mm ? "10px" : "11px"}; font-weight: bold; font-style: italic; margin-top: 2px; padding: 2px 4px; border-left: 2px solid #000;">** ${escapeHtml(notes)}</div>` : ""}
                    </div>
                </div>
            </div>
        `;
    });

    // Total quantity counter for easy kitchen verification
    const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 1), 0);
    itemsHtml += `
        <div style="display: flex; justify-content: space-between; font-weight: 900; margin-top: 6px; padding-top: 4px; border-top: 1px solid #000; font-size: ${is58mm ? "11px" : "12px"};">
            <span>TOTAL ITEMS:</span>
            <span>${items.length} items (${totalQty} pcs)</span>
        </div>
    `;

    itemsHtml += `</div>`;

    // ── 5. FOOTER ──────────────────────────────────────────
    let footerHtml = "";
    if (cfg.footer_text && cfg.footer_text.trim()) {
        footerHtml = `
            <div style="text-align: center; margin-top: 10px; font-size: ${is58mm ? "10px" : "11px"}; font-weight: bold; text-transform: uppercase; border-top: 1px dashed #000; padding-top: 6px;">
                ${escapeHtml(cfg.footer_text)}
            </div>
        `;
    }

    return `
        <div style="${fontStyle} ${containerStyle}">
            ${headerHtml}
            ${doubleDivider}
            ${orderTypeBannerHtml}
            ${metaHtml}
            ${heavyDivider}
            ${itemsHtml}
            ${dashedDivider}
            ${footerHtml}
        </div>
    `;
}

/**
 * Trigger browser print popup using the formatted KOT HTML.
 */
export function printKitchenTicket({ order = {}, restaurant = {}, format = {} }) {
    const cfg = { ...DEFAULT_KITCHEN_FORMAT, ...format };
    const is58mm = cfg.paper_size === "thermal-58";

    const width = is58mm ? 280 : 360;
    const height = 600;

    const printContent = generateKitchenTicketHtml({ order, restaurant, format: cfg });

    const isParcel = isParcelOrder(order);
    const titleLabel = isParcel ? `KOT-PARCEL-${order.order_number || ""}` : `KOT-${order.tableName || order.table_name || "Order"}`;

    const w = window.open("", "PrintKOT", `width=${width},height=${height},toolbar=0,scrollbars=1,status=0`);
    if (!w) {
        alert("Print window was blocked by browser. Please allow popups to print Kitchen Order Tickets.");
        return false;
    }

    w.document.open();
    w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(titleLabel)}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
                @page {
                    size: auto;
                    margin: 0;
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

    setTimeout(() => {
        try {
            w.print();
        } catch (e) {
            console.error("Kitchen Print invocation error:", e);
        }
    }, 250);

    return true;
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

const kitchenPrinter = {
    DEFAULT_KITCHEN_FORMAT,
    isParcelOrder,
    generateKitchenTicketHtml,
    printKitchenTicket
};

export default kitchenPrinter;
