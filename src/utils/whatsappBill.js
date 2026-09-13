// Send a bill to the customer on WhatsApp — click-to-chat, no API.
//
// The till opens WhatsApp (Web in its own window, or the desktop app) on the
// customer's chat with the whole bill already typed in; the receptionist only
// presses Send. Nothing here talks to WhatsApp's servers, so there is no account,
// approval or per-message cost — and nothing is sent without a person pressing
// Send, which is also WhatsApp's rule for a normal number.
//
// The wording is the owner's (Settings → Bills & WhatsApp, settings.whatsapp_template):
// a template with {tags}. Pure functions except openWhatsApp and the per-till
// preference, so the message can be tested directly (tests/whatsappBill.test.mjs).

const rupees = (n) => `₹${(Number(n) || 0).toFixed(2)}`;

// ── How the salon hands over bills (settings.bill_delivery) ──────────────────
//   printer_optional  payment offers "Send on WhatsApp" and "Print" (Print also sends)
//   no_printer        payment only sends on WhatsApp; the till's Printer screen is hidden
export const BILL_DELIVERY = { PRINTER_OPTIONAL: "printer_optional", NO_PRINTER: "no_printer" };

export const normalizeBillDelivery = (v) =>
    v === BILL_DELIVERY.NO_PRINTER ? BILL_DELIVERY.NO_PRINTER : BILL_DELIVERY.PRINTER_OPTIONAL;

// ── The message template ─────────────────────────────────────────────────────

export const DEFAULT_WHATSAPP_TEMPLATE = [
    "*{salon_name}*",
    "Hi {customer_name}, thank you for visiting us!",
    "",
    "Bill No: *{bill_no}*",
    "Date: {date}",
    "Stylist: {stylist}",
    "",
    "{services}",
    "",
    "{amounts}",
    "Paid via: {payment_method}",
    "",
    "{salon_address}",
    "Ph: {salon_phone}",
    "",
    "See you again soon!"
].join("\n");

export const WHATSAPP_TEMPLATE_MAX = 2000;

// What the owner can put in the message. Shown as insertable chips in Settings.
export const WHATSAPP_TAGS = [
    { tag: "{salon_name}", label: "Salon name" },
    { tag: "{customer_name}", label: "Customer name" },
    { tag: "{bill_no}", label: "Bill number" },
    { tag: "{date}", label: "Date & time" },
    { tag: "{stylist}", label: "Stylist" },
    { tag: "{services}", label: "Services list" },
    { tag: "{amounts}", label: "Subtotal, discount, GST & total" },
    { tag: "{total}", label: "Total only" },
    { tag: "{payment_method}", label: "Paid via" },
    { tag: "{salon_phone}", label: "Shop number" },
    { tag: "{salon_address}", label: "Salon address" }
];

// The bill the Settings preview is drawn with.
export const SAMPLE_BILL = {
    order_number: "0042",
    customer_name: "Anita",
    stylist_name: "Meena",
    date: "13 Sep 2026",
    time: "04:35 pm",
    items: [
        { item_name: "Haircut", price: 300, quantity: 2 },
        { item_name: "Hair Spa", price: 900, quantity: 1 }
    ],
    subtotal: 1500,
    discount: 150,
    discount_label: "Discount (10%)",
    lines: [{ name: "GST 18%", amount: 243 }],
    total: 1593,
    payment_method: "UPI"
};

const TAG_RE = /\{([a-z_]+)\}/g;

/**
 * Fill a template. A line whose tags all come out empty is dropped (no
 * "Stylist: " with nothing after it), unknown {tags} are left as typed, and runs
 * of blank lines collapse to one.
 */
export function renderTemplate(template, values = {}) {
    const lines = String(template ?? "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    for (const line of lines) {
        const known = [...line.matchAll(TAG_RE)].map((m) => m[1]).filter((k) => k in values);
        if (known.length > 0 && known.every((k) => !String(values[k] ?? "").trim())) continue;
        out.push(line.replace(TAG_RE, (m, k) => (k in values ? String(values[k] ?? "") : m)));
    }
    return out
        .join("\n")
        .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
        .trim();
}

/**
 * A mobile number as WhatsApp wants it: digits with the country code, no "+".
 * 10 digits get the country code; a leading 0 or an existing code is handled.
 * Anything else is null — better no button than a message to a wrong number.
 */
export function whatsappNumber(mobile, countryCode = "91") {
    const digits = String(mobile || "").replace(/\D/g, "");
    if (digits.length === 10) return countryCode + digits;
    if (digits.length === 11 && digits.startsWith("0")) return countryCode + digits.slice(1);
    if (digits.length === 12 && digits.startsWith(countryCode)) return digits;
    return null;
}

/** One line per service + price, however many order_item rows it was stored as. */
export function groupItems(rows = []) {
    const out = [];
    const byKey = {};
    (Array.isArray(rows) ? rows : []).forEach((r) => {
        const name = r.item_name || r.name || "Service";
        const price = Number(r.price) || 0;
        const key = `${name}|${price}`;
        if (!byKey[key]) {
            byKey[key] = { item_name: name, price, quantity: 0 };
            out.push(byKey[key]);
        }
        byKey[key].quantity += Number(r.quantity) || 0;
    });
    return out.filter((i) => i.quantity > 0);
}

/**
 * The bill just paid (BillModal hands it over), in the shape buildBillMessage
 * reads. Charge lines are the tax / service lines plus every charge on the bill,
 * already in rupees.
 */
export function billFromPrintedOrder(o = {}) {
    return {
        order_number: o.order_number,
        customer_name: o.customer_name,
        stylist_name: o.stylist_name,
        date: o.date,
        time: o.time,
        items: groupItems(o.items),
        subtotal: o.subtotal,
        discount: o.discount,
        discount_label: o.discount_label,
        lines: [...(o.taxLines || []), ...(o.charges || [])]
            .map((c) => ({ name: c.charge_name, amount: Number(c.amount) || 0 }))
            .filter((c) => c.name && c.amount > 0),
        total: o.grand_total ?? o.total,
        payment_method: o.payment_method
    };
}

/**
 * A saved bill (GET /orders/bills/:id header + GET /orders/:id items). The
 * header carries totals, not charge names, so they print by bucket.
 */
export function billFromSaved(header = {}, rows = []) {
    const at = header.created_at ? new Date(header.created_at) : null;
    const pct = header.discount_percent;
    const lines = [
        { name: "GST", amount: Number(header.tax) || 0 },
        { name: "Service charge", amount: Number(header.service_charge) || 0 },
        { name: "Other charges", amount: Number(header.charges_total) || 0 }
    ].filter((l) => l.amount > 0);

    return {
        order_number: header.order_number,
        customer_name: header.customer_name,
        stylist_name: header.stylist_name,
        date: at ? at.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "",
        time: at ? at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        items: groupItems(rows),
        subtotal: header.subtotal,
        discount: header.discount,
        discount_label: pct !== null && pct !== undefined ? `Discount (${Number(pct)}%)` : "Discount",
        lines,
        total: header.grand_total,
        payment_method: header.payment_method
    };
}

/**
 * The WhatsApp message: the owner's template (or the default) filled with this
 * bill. *bold* is WhatsApp's own formatting. Plain lines, no column padding —
 * WhatsApp's font is proportional, so aligned columns would come out ragged.
 *
 * shop.mobile is the shop number given when the salon was created
 * (restaurants.mobile, returned by GET /settings/restaurant as shop_mobile).
 */
export function buildBillMessage(bill = {}, shop = {}, template = "") {
    const amounts = [`Subtotal: ${rupees(bill.subtotal)}`];
    if (Number(bill.discount) > 0) amounts.push(`${bill.discount_label || "Discount"}: -${rupees(bill.discount)}`);
    (bill.lines || []).forEach((l) => amounts.push(`${l.name}: ${rupees(l.amount)}`));
    amounts.push(`*Total: ${rupees(bill.total)}*`);

    const values = {
        salon_name: String(shop.restaurant_name || "").trim(),
        customer_name: String(bill.customer_name || "").trim(),
        bill_no: bill.order_number || "",
        date: [bill.date, bill.time].filter(Boolean).join(", "),
        stylist: bill.stylist_name || "",
        services: (bill.items || [])
            .map((i) => `${i.item_name} x${Number(i.quantity)} - ${rupees(Number(i.price) * Number(i.quantity))}`)
            .join("\n"),
        amounts: amounts.join("\n"),
        total: rupees(bill.total),
        payment_method: bill.payment_method || "",
        salon_phone: String(shop.mobile || shop.phone || "").trim(),
        salon_address: String(shop.address || "").trim()
    };

    const tpl = String(template || "").trim() ? template : DEFAULT_WHATSAPP_TEMPLATE;
    return renderTemplate(tpl, values);
}

/** WhatsApp Web (`web`) or the installed desktop app (`app`). */
export function whatsappUrl(phone, text, via = "web") {
    const q = `phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}`;
    return via === "app"
        ? `whatsapp://send?${q}`
        : `https://web.whatsapp.com/send?${q}`;
}

/**
 * Open it. Returns false only when the browser blocked the WhatsApp window, so
 * the screen can offer a button instead. (The desktop app can't report back:
 * if it isn't installed, nothing happens.)
 */
export function openWhatsApp(url, via = "web") {
    if (via === "app") {
        const a = document.createElement("a");
        a.href = url;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return true;
    }
    // One named window, reused for every bill, so the till doesn't fill up with
    // WhatsApp tabs.
    const w = window.open(url, "inwallz-whatsapp");
    if (!w) return false;
    try {
        w.opener = null;
        w.focus();
    } catch (e) { /* cross-origin already — nothing to do */ }
    return true;
}

// ── Per-till preference ──────────────────────────────────────────────────────
// Which WhatsApp this PC has. A property of the machine, not the salon, so it
// lives in this browser.

const PREFS_KEY = "inwallz_whatsapp_prefs";
export const DEFAULT_WHATSAPP_PREFS = { via: "web" };

export function getWhatsAppPrefs() {
    try {
        const saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) || "null");
        return { via: saved && saved.via === "app" ? "app" : "web" };
    } catch (e) {
        return { ...DEFAULT_WHATSAPP_PREFS };
    }
}

export function setWhatsAppPrefs(prefs) {
    try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) { /* private window / storage blocked — keep for this session only */ }
}
