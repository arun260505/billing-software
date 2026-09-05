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
    const orderNumber = order.order_number || "ORD-1001";
    const tableName = order.tableName || order.table_name || (order.table_number ? `Table ${order.table_number}` : "Counter");
    const paymentMethod = order.payment_method || order.paymentMethod || "Cash";
    const paymentList = Array.isArray(order.payments) && order.payments.length ? order.payments : null;

    // ── Header ──
    if (cfg.header_title && cfg.header_title.trim()) {
        out.push(center(cfg.header_title.trim().toUpperCase(), W));
    }
    if (cfg.show_restaurant_name) {
        out.push(center((restaurant.restaurant_name || "Restaurant").toUpperCase(), W));
    }
    const addr = [restaurant.address, restaurant.city, restaurant.state, restaurant.pincode]
        .filter((p) => p && String(p).trim())
        .join(", ");
    if (cfg.show_address && addr) wrap(addr, W).forEach((l) => out.push(center(l, W)));
    if (cfg.show_phone && restaurant.mobile) out.push(center(`Ph: ${restaurant.mobile}`, W));
    if (cfg.show_email && restaurant.email) out.push(center(restaurant.email, W));
    if (cfg.show_gst && restaurant.gst_number) out.push(center(`GSTIN: ${restaurant.gst_number}`, W));
    if (cfg.show_fssai && restaurant.fssai_number) out.push(center(`FSSAI: ${restaurant.fssai_number}`, W));

    out.push(repeat("=", W));

    // ── Order meta ──
    if (cfg.show_order_number) out.push(lr("Bill:", orderNumber, W));
    if (cfg.show_table_name) out.push(lr("Table:", tableName, W));
    if (cfg.show_date) out.push(lr("Date:", dateStr, W));
    if (cfg.show_time) out.push(lr("Time:", timeStr, W));
    if (cfg.show_customer_name && order.customer_name) out.push(lr("Customer:", order.customer_name, W));
    if (cfg.show_waiter_name && (order.waiter_name || order.waiter)) out.push(lr("Waiter:", order.waiter_name || order.waiter, W));
    if (cfg.show_cashier_name && (order.cashier_name || order.cashier)) out.push(lr("Cashier:", order.cashier_name || order.cashier, W));

    out.push(repeat("-", W));

    // ── Items: name on its own line, then qty x rate ....... amount ──
    // Widened for the two decimals amounts now carry ("Rs.1234.50"), so the
    // amount column still lines up on a 32-column 58mm roll.
    const amtW = 11;
    const qtyRateW = 14;
    out.push(lr("Item", "Amount", W));
    out.push(repeat("-", W));

    items.forEach((it) => {
        const qty = Number(it.quantity || 1);
        const rate = Number(it.price || 0);
        const lineTotal = rate * qty;

        wrap(it.item_name || it.name || "Item", W).forEach((l) => out.push(l));

        const bits = [];
        if (cfg.show_item_qty) bits.push(`${qty}`);
        if (cfg.show_item_qty && cfg.show_item_price) bits.push("x");
        if (cfg.show_item_price) bits.push(money(rate));
        const left = bits.length ? `  ${bits.join(" ")}` : "  ";

        out.push(lr(left.padEnd(Math.min(qtyRateW, W - amtW)), money(lineTotal), W));

        if (it.notes) wrap(`* ${it.notes}`, W - 2).forEach((l) => out.push(`  ${l}`));
    });

    out.push(repeat("-", W));

    // ── Summary ──
    if (cfg.show_subtotal) out.push(lr("Subtotal", money(subtotal), W));
    if (cfg.show_tax && tax > 0) out.push(lr("GST / Tax", money(tax), W));
    if (cfg.show_service_charge && serviceCharge > 0) out.push(lr("Service Charge", money(serviceCharge), W));
    if (cfg.show_charges && charges.length > 0) {
        charges.forEach((c) => {
            const val = c.charge_type === "Percentage"
                ? Math.round(subtotal * Number(c.amount) / 100)
                : Number(c.amount);
            out.push(lr(c.charge_name, money(val), W));
        });
    }

    if (cfg.show_grand_total) {
        out.push(repeat("=", W));
        out.push(lr("TOTAL", money(grandTotal), W));
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
        out.push(center(cfg.header_title.trim().toUpperCase(), W));
    }
    if (cfg.show_restaurant_name) {
        out.push(center((restaurant.restaurant_name || "Restaurant").toUpperCase(), W));
    }
    const addr = [restaurant.address, restaurant.city].filter((p) => p && String(p).trim()).join(", ");
    if (cfg.show_address && addr) wrap(addr, W).forEach((l) => out.push(center(l, W)));
    if (cfg.show_phone && restaurant.mobile) out.push(center(`Ph: ${restaurant.mobile}`, W));

    out.push(repeat("=", W));

    if (isParcel) {
        out.push(center("*** PARCEL ***", W));
        out.push(center("[ TAKEAWAY PACKING ]", W));
        out.push(repeat("=", W));
    }

    if (cfg.show_order_number) out.push(lr("KOT / ORD:", `#${orderNumber}`, W));
    if (cfg.show_order_type) out.push(lr("Type:", isParcel ? "PARCEL / TAKEAWAY" : "DINE-IN", W));
    if (cfg.show_table_name && !isParcel) out.push(lr("TABLE:", tableName, W));

    const dt = [];
    if (cfg.show_date) dt.push(dateStr);
    if (cfg.show_time) dt.push(timeStr);
    if (dt.length) out.push(lr("Time:", dt.join(" | "), W));

    if (cfg.show_waiter_name && (order.waiter_name || order.waiter)) out.push(lr("Waiter:", order.waiter_name || order.waiter, W));
    if (cfg.show_cashier_name && (order.cashier_name || order.cashier)) out.push(lr("Cashier:", order.cashier_name || order.cashier, W));
    if (cfg.show_customer_name && order.customer_name) out.push(lr("Customer:", order.customer_name, W));

    out.push(repeat("-", W));
    out.push(cfg.show_item_qty ? "QTY  ITEM" : "ITEM");
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

        const nameLines = cfg.show_item_name ? wrap(name, W - prefix.length) : [""];
        nameLines.forEach((l, i) => out.push((i === 0 ? prefix : indent) + l));

        if (cfg.show_item_notes && (it.notes || it.note)) {
            wrap(`** ${it.notes || it.note}`, W - prefix.length).forEach((l) => out.push(indent + l));
        }
        out.push("");
    });

    out.push(repeat("-", W));
    out.push(lr("TOTAL ITEMS:", `${items.length} items (${totalQty} pcs)`, W));

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

    out.push(center("PRINTER TEST", W));
    if (restaurantName) out.push(center(restaurantName.toUpperCase(), W));
    out.push(repeat("=", W));
    out.push(lr("Printer:", printerName || "(not set)", W));
    if (role) out.push(lr("Prints:", role, W));
    out.push(lr("Date:", now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), W));
    out.push(lr("Time:", now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), W));
    out.push(repeat("=", W));
    out.push(center("If you can read this,", W));
    out.push(center("the printer works.", W));
    out.push("");
    out.push(center("InWallz POS", W));

    return out.join("\n");
}

const receiptText = { buildBillText, buildKotText, buildTestText };

export default receiptText;
