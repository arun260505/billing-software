/**
 * Plain-text receipt renderers for DIRECT printing.
 *
 * The browser can never print without showing its dialog, so a direct print goes
 * through the local backend instead (POST /api/print), which spools the text to a
 * named Windows printer. Thermal printers render monospace text natively, so text
 * is the right wire format here — the HTML renderers in billPrinter.js /
 * kitchenPrinter.js stay as they are for on-screen previews and the fallback path.
 *
 * The same `format` config drives both, so a bill printed directly shows the same
 * fields as the HTML one.
 */

import { sanitizeCharges } from "./charges";
import { DEFAULT_BILL_FORMAT } from "./billPrinter";
import { DEFAULT_KITCHEN_FORMAT, isParcelOrder } from "./kitchenPrinter";

// Windows spools this through a GDI font that may not carry the ₹ glyph (U+20B9),
// and a missing glyph prints as a box on every line of every bill. "Rs." is safe
// on every printer. Switch this to "₹" if your printer's font handles it.
const RUPEE = "Rs.";

/*
| Emphasis (bold / double height)
|
| This receipt reaches the printer as RAW bytes, so bold is not a font choice —
| it is an ESC/POS command the printer obeys. The `font-weight: bold` in
| billPrinter.js only styles the admin preview and the browser-dialog fallback,
| which is why a bill that looked bold on screen printed flat on the roll.
|
| backend/scripts/print-text.ps1 already speaks ESC/POS (it sends the reset and
| the paper cut), and maps each character to one byte, so these pass straight
| through.
|
| Applied to WHOLE finished lines, never inside one: every column below is padded
| by string length, and a control character counted as a column would knock the
| money out of alignment.
*/
const ESC = "\x1b";
const GS = "\x1d";

/** ESC E 1 / ESC E 0 — the printer's own emphasised (double-strike) mode. */
const bold = (line) => `${ESC}E\x01${line}${ESC}E\x00`;

// GS ! 0x01 — double HEIGHT only. Double width would halve the columns per line
// and wrap the header, so the big lines here grow downwards, not sideways.
const tall = (line) => `${GS}!\x01${line}${GS}!\x00`;

/** Both, for the one or two lines that have to carry across a counter. */
const heading = (line) => bold(tall(line));

// Characters per line. 58mm thermal paper fits ~32, 80mm fits ~48.
function widthFor(paperSize) {
    return paperSize === "thermal-58" ? 32 : 48;
}

const repeat = (ch, n) => (n > 0 ? ch.repeat(n) : "");

function center(text, width) {
    const s = String(text || "");
    if (s.length >= width) return s.slice(0, width);
    const pad = Math.floor((width - s.length) / 2);
    return repeat(" ", pad) + s;
}

/** "Subtotal" + "Rs.250" pushed to opposite edges of the line. */
function lr(left, right, width) {
    const l = String(left || "");
    const r = String(right || "");
    const gap = width - l.length - r.length;
    if (gap < 1) {
        // Too long to sit on one line — clip the label, never the amount.
        const room = Math.max(0, width - r.length - 1);
        return `${l.slice(0, room)} ${r}`;
    }
    return l + repeat(" ", gap) + r;
}

/** Wrap a long item name onto continuation lines. */
function wrap(text, width) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "";
    words.forEach((w) => {
        if (!cur.length) {
            cur = w;
        } else if ((cur + " " + w).length <= width) {
            cur += " " + w;
        } else {
            lines.push(cur);
            cur = w;
        }
    });
    if (cur.length) lines.push(cur);
    return lines.length ? lines : [""];
}

/** Pad a cell to `w`, right-aligned when `right`, clipping anything longer. */
function cell(text, w, right = false) {
    const s = String(text == null ? "" : text);
    if (s.length >= w) return s.slice(0, w);
    return right ? repeat(" ", w - s.length) + s : s + repeat(" ", w - s.length);
}

/**
 * Column widths for the No. / Item / Qty. / Price / Amount grid. The money
 * columns keep their width on a 58mm roll and the item name column absorbs the
 * difference, wrapping onto continuation lines.
 */
function itemCols(W) {
    const wide = W >= 40;
    const no = 3;
    const qty = wide ? 5 : 3;
    const price = wide ? 9 : 7;
    const amt = wide ? 10 : 8;
    return { no, qty, price, amt, item: W - no - qty - price - amt };
}

/** " 5%" for a line worth 5% of the subtotal, "" when it is not expressible. */
function percentOf(part, base) {
    if (!(Number(base) > 0) || !(Number(part) > 0)) return "";
    const p = Math.round((Number(part) / Number(base)) * 10000) / 100;
    if (!(p > 0)) return "";
    return ` ${Number.isInteger(p) ? p : p.toFixed(2)}%`;
}

// Two decimals by default. This renderer produces the slip that is spooled
// straight to the till printer, and it was rounding every line to whole rupees
// while the split-payment lines (the only caller passing dp explicitly) printed
// paise — so a receipt could read Subtotal 238 + GST 12 + Service 5 against a
// TOTAL of 254, and a split payment visibly failed to match its own total.
const money = (n, dp = 2) => `${RUPEE}${Number(n || 0).toFixed(dp)}`;

/**
 * The customer bill as text. Mirrors generateBillHtml's field logic so the two
 * cannot disagree about what a given format setting means.
 */
export function buildBillText({ order = {}, restaurant = {}, format = {} }) {
    const cfg = { ...DEFAULT_BILL_FORMAT, ...format };
    const W = widthFor(cfg.paper_size);
    const out = [];

    const items = order.items || [];
    const subtotal = Number(order.subtotal || 0);
    const tax = Number(order.tax || order.gst || 0);
    const serviceCharge = Number(order.service_charge || order.serviceCharge || 0);
    const charges = sanitizeCharges(order.charges || order.selectedCharges);
    const chargesTotal = charges.reduce((sum, c) => {
        if (c.charge_type === "Percentage") return sum + Math.round(subtotal * Number(c.amount) / 100);
        return sum + Number(c.amount || 0);
    }, 0);
    const grandTotal = Number(
        order.grand_total || order.total || (subtotal + tax + serviceCharge + chargesTotal)
    );

    const dateStr = order.date || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = order.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    // No invented placeholder — see billPrinter.js. The line is dropped rather
    // than printing a number the bill does not have.
    const orderNumber = order.order_number || "";
    const tableName = order.tableName || order.table_name || (order.table_number ? `Table ${order.table_number}` : "Counter");
    const isParcel = isParcelOrder(order);
    const seatValue = order.table_number || String(tableName).replace(/^table\s*/i, "");
    const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 1), 0);
    const paymentMethod = order.payment_method || order.paymentMethod || "Cash";
    const paymentList = Array.isArray(order.payments) && order.payments.length ? order.payments : null;

    // ── Header ── (the emphasised block, matching the reference bill)
    if (cfg.header_title && cfg.header_title.trim()) {
        out.push(bold(center(cfg.header_title.trim().toUpperCase(), W)));
    }
    if (cfg.show_restaurant_name) {
        out.push(heading(center((restaurant.restaurant_name || "Restaurant").toUpperCase(), W)));
    }
    // GSTIN under the trading name, then the postal address — the order the
    // printed reference bill reads in.
    if (cfg.show_gst && restaurant.gst_number) out.push(bold(center(restaurant.gst_number, W)));
    const addr = [restaurant.address, restaurant.city, restaurant.state, restaurant.pincode]
        .filter((p) => p && String(p).trim())
        .join(", ");
    if (cfg.show_address && addr) wrap(addr, W).forEach((l) => out.push(bold(center(l, W))));
    if (cfg.show_phone && restaurant.mobile) out.push(center(`Ph: ${restaurant.mobile}`, W));
    if (cfg.show_email && restaurant.email) out.push(center(restaurant.email, W));
    if (cfg.show_fssai && restaurant.fssai_number) out.push(center(`FSSAI: ${restaurant.fssai_number}`, W));

    out.push(repeat("=", W));

    // ── Order meta: a name rule, then fields paired two to a line ──
    if (cfg.show_customer_name) {
        out.push(`Name: ${order.customer_name || ""}`.trimEnd());
        out.push(repeat("-", W));
    }

    const metaBits = [];
    if (cfg.show_date) metaBits.push(`Date: ${dateStr}`);
    if (cfg.show_table_name) metaBits.push(isParcel ? "Take Away" : `Dine In: ${seatValue}`);
    if (cfg.show_time) metaBits.push(`Time: ${timeStr}`);
    if (cfg.show_waiter_name && (order.waiter_name || order.waiter)) metaBits.push(`Waiter: ${order.waiter_name || order.waiter}`);
    if (cfg.show_cashier_name && (order.cashier_name || order.cashier)) metaBits.push(`Cashier: ${order.cashier_name || order.cashier}`);
    if (cfg.show_order_number && orderNumber) metaBits.push(`Bill No.: ${orderNumber}`);

    const leftW = Math.ceil(W * 0.52);
    for (let i = 0; i < metaBits.length; i += 2) {
        out.push((cell(metaBits[i], leftW) + (metaBits[i + 1] || "")).trimEnd());
    }

    out.push(repeat("-", W));

    // ── Items: No. | Item | Qty. | Price | Amount ──
    // The money columns carry no currency mark, so they stay aligned on a
    // 32-column roll; only the grand total below is prefixed.
    const C = itemCols(W);
    out.push(bold(
        cell("No.", C.no) +
        cell("Item", C.item) +
        (cfg.show_item_qty ? cell("Qty.", C.qty, true) : repeat(" ", C.qty)) +
        (cfg.show_item_price ? cell("Price", C.price, true) : repeat(" ", C.price)) +
        cell("Amount", C.amt, true)
    ));
    out.push(repeat("-", W));

    items.forEach((it, idx) => {
        const qty = Number(it.quantity || 1);
        const rate = Number(it.price || 0);
        const lineTotal = rate * qty;
        const nameLines = wrap(it.item_name || it.name || "Item", C.item - 1);

        out.push(
            cell(`${idx + 1}`, C.no) +
            cell(nameLines[0], C.item) +
            (cfg.show_item_qty ? cell(qty, C.qty, true) : repeat(" ", C.qty)) +
            (cfg.show_item_price ? cell(rate.toFixed(2), C.price, true) : repeat(" ", C.price)) +
            cell(lineTotal.toFixed(2), C.amt, true)
        );
        // Continuation lines of a long name sit under the item column.
        nameLines.slice(1).forEach((l) => out.push(repeat(" ", C.no) + l));

        if (it.notes) wrap(`* ${it.notes}`, C.item - 1).forEach((l) => out.push(repeat(" ", C.no) + l));
    });

    out.push(repeat("-", W));

    // ── Summary ──
    const summaryRows = [];
    if (cfg.show_subtotal) summaryRows.push(["Sub Total", subtotal.toFixed(2)]);
    if (cfg.show_tax && tax > 0) summaryRows.push([`GST${percentOf(tax, subtotal)}`, tax.toFixed(2)]);
    if (cfg.show_service_charge && serviceCharge > 0) {
        summaryRows.push([`Service Charge${percentOf(serviceCharge, subtotal)}`, serviceCharge.toFixed(2)]);
    }
    if (cfg.show_charges && charges.length > 0) {
        charges.forEach((c) => {
            const val = c.charge_type === "Percentage"
                ? Math.round(subtotal * Number(c.amount) / 100)
                : Number(c.amount);
            const label = c.charge_type === "Percentage" ? `${c.charge_name} ${Number(c.amount)}%` : c.charge_name;
            summaryRows.push([label, val.toFixed(2)]);
        });
    }

    // Total Qty prints alongside the first summary line, as on the reference bill.
    const qtyLabel = cfg.show_item_qty ? `Total Qty: ${totalQty}` : "";
    const moneyW = Math.min(W - 2, Math.max(18, C.qty + C.price + C.amt));
    summaryRows.forEach(([label, val], i) => {
        const left = i === 0 ? qtyLabel : "";
        out.push(cell(left, W - moneyW) + lr(label, val, moneyW));
    });

    if (cfg.show_grand_total) {
        out.push(repeat("=", W));
        out.push(heading(lr("Grand Total", money(grandTotal), W)));
        out.push(repeat("=", W));
    }

    // ── Payment ──
    if (cfg.show_payment_method) {
        if (paymentList && paymentList.length > 1) {
            out.push("Payment Split:");
            paymentList.forEach((p) => out.push(lr(`  ${p.method || "Cash"}`, money(p.amount, 2), W)));
        } else {
            out.push(lr("Payment Mode:", paymentMethod, W));
        }
    }

    // ── Footer ──
    if (cfg.footer_text && cfg.footer_text.trim()) {
        out.push("");
        wrap(cfg.footer_text.trim(), W).forEach((l) => out.push(center(l, W)));
    }
    if (cfg.terms_text && cfg.terms_text.trim()) {
        cfg.terms_text.split(/\r?\n/).forEach((raw) => {
            wrap(raw, W).forEach((l) => out.push(center(l, W)));
        });
    }

    return out.join("\n");
}

/**
 * The kitchen ticket as text. Big and sparse on purpose — a cook reads this
 * across a pass, so quantities lead and prices never appear.
 */
export function buildKotText({ order = {}, restaurant = {}, format = {} }) {
    const cfg = { ...DEFAULT_KITCHEN_FORMAT, ...format };
    const W = widthFor(cfg.paper_size);
    const out = [];

    const items = order.items || [];
    const dateStr = order.date || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = order.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const orderNumber = order.order_number || "ORD-1024";

    const isParcel = isParcelOrder(order);
    const tableName = isParcel
        ? "PARCEL / TAKEAWAY"
        : (order.tableName || order.table_name || (order.table_number ? `Table ${order.table_number}` : "Dine-In"));

    if (cfg.header_title && cfg.header_title.trim()) {
        out.push(bold(center(cfg.header_title.trim().toUpperCase(), W)));
    }
    if (cfg.show_restaurant_name) {
        out.push(bold(center((restaurant.restaurant_name || "Restaurant").toUpperCase(), W)));
    }
    const addr = [restaurant.address, restaurant.city].filter((p) => p && String(p).trim()).join(", ");
    if (cfg.show_address && addr) wrap(addr, W).forEach((l) => out.push(center(l, W)));
    if (cfg.show_phone && restaurant.mobile) out.push(center(`Ph: ${restaurant.mobile}`, W));

    out.push(repeat("=", W));

    // Dine-in gets the same banner as parcel — the table number is what a cook
    // reads first, so it leads the ticket instead of sitting in a metadata row.
    // Emphasised and double height: this is the line read from across the pass.
    out.push(heading(center(
        isParcel
            ? "*** PARCEL ***"
            : (cfg.show_table_name ? `*** ${String(tableName).toUpperCase()} ***` : "*** DINE-IN ***"),
        W
    )));
    out.push(bold(center(isParcel ? "[ TAKEAWAY PACKING ]" : "[ DINE - IN ]", W)));
    out.push(repeat("=", W));

    // The number the pass calls out when the dish goes up — same weight as the
    // table banner, so both are readable at arm's length.
    if (cfg.show_order_number) out.push(heading(lr("KOT / ORD:", `#${orderNumber}`, W)));
    if (cfg.show_order_type) out.push(lr("Type:", isParcel ? "PARCEL / TAKEAWAY" : "DINE-IN", W));

    const dt = [];
    if (cfg.show_date) dt.push(dateStr);
    if (cfg.show_time) dt.push(timeStr);
    if (dt.length) out.push(lr("Time:", dt.join(" | "), W));

    if (cfg.show_waiter_name && (order.waiter_name || order.waiter)) out.push(lr("Waiter:", order.waiter_name || order.waiter, W));
    if (cfg.show_cashier_name && (order.cashier_name || order.cashier)) out.push(lr("Cashier:", order.cashier_name || order.cashier, W));
    if (cfg.show_customer_name && order.customer_name) out.push(lr("Customer:", order.customer_name, W));

    out.push(repeat("-", W));
    out.push(bold(cfg.show_item_qty ? "QTY  ITEM" : "ITEM"));
    out.push(repeat("-", W));

    let totalQty = 0;
    items.forEach((it) => {
        const qty = Number(it.quantity || 1);
        totalQty += qty;
        const name = it.item_name || it.name || "Item";
        const prefix = cfg.show_item_qty ? `${qty}x`.padEnd(5) : "";
        const indent = repeat(" ", prefix.length);

        if (cfg.show_item_category && (it.category_name || it.category)) {
            out.push(`${indent}[${it.category_name || it.category}]`);
        }

        // The dish and its quantity are what gets cooked — emphasised, while the
        // category and any note stay light so the item still stands out.
        const nameLines = cfg.show_item_name ? wrap(name, W - prefix.length) : [""];
        nameLines.forEach((l, i) => out.push(bold((i === 0 ? prefix : indent) + l)));

        if (cfg.show_item_notes && (it.notes || it.note)) {
            wrap(`** ${it.notes || it.note}`, W - prefix.length).forEach((l) => out.push(bold(indent + l)));
        }
        out.push("");
    });

    out.push(repeat("-", W));
    out.push(bold(lr("TOTAL ITEMS:", `${items.length} items (${totalQty} pcs)`, W)));

    if (cfg.footer_text && cfg.footer_text.trim()) {
        out.push("");
        wrap(cfg.footer_text.trim().toUpperCase(), W).forEach((l) => out.push(center(l, W)));
    }

    return out.join("\n");
}

/** The short slip behind the Test print button on the cashier Printer page. */
export function buildTestText({ printerName = "", role = "", restaurantName = "", paperSize = "thermal" } = {}) {
    const W = widthFor(paperSize);
    const now = new Date();
    const out = [];

    out.push(heading(center("PRINTER TEST", W)));
    if (restaurantName) out.push(bold(center(restaurantName.toUpperCase(), W)));
    out.push(repeat("=", W));
    out.push(lr("Printer:", printerName || "(not set)", W));
    if (role) out.push(lr("Prints:", role, W));
    out.push(lr("Date:", now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), W));
    out.push(lr("Time:", now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), W));
    out.push(repeat("=", W));
    out.push(center("If you can read this,", W));
    out.push(center("the printer works.", W));
    out.push("");
    // The title above is emphasised and double height. If these two lines look
    // identical on the slip, the printer is ignoring ESC/POS emphasis and the
    // bold on the bill will not come out either — which is the one thing a test
    // print should be able to tell you.
    out.push(bold(center("This line should be BOLD.", W)));
    out.push(center("This line should be normal.", W));
    out.push("");
    out.push(center("InWallz POS", W));

    return out.join("\n");
}

const receiptText = { buildBillText, buildKotText, buildTestText };

export default receiptText;
