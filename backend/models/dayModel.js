const db = require("../config/db").promise();

/*
| Open / close the business day (cash-up / Z-report).
|
| One row per business day (day_closures): created "open" when the cashier opens
| the day, updated to "closed" with a snapshot of the day's totals + Cash/Card/UPI
| collection when they close it. Billing is meant to happen only while today is
| open; the next day the cashier opens again. A day that has sales but was never
| closed is surfaced (getPendingUnclosed) so a forgotten close is caught.
|
| Sales come from orders (Paid, not cancelled); the tender split from payments.
| A closure never changes a sale — it only records and marks.
*/

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

// The day's sales totals + tender breakdown, computed live for `date`.
async function getDaySummary(restaurantId, date) {
    const [[o]] = await db.query(
        `SELECT
            COUNT(*)                       AS bills,
            IFNULL(SUM(subtotal), 0)       AS gross_sales,
            IFNULL(SUM(discount), 0)       AS discount_total,
            IFNULL(SUM(tax) + SUM(service_charge), 0) AS tax_total,
            IFNULL(SUM(grand_total), 0)    AS net_sales
         FROM orders
         WHERE restaurant_id = ? AND payment_status = 'Paid'
           AND order_status <> 'Cancelled' AND deleted_at IS NULL
           AND DATE(created_at) = ?`,
        [restaurantId, date]
    );

    const [rows] = await db.query(
        `SELECT payment_method AS method, IFNULL(SUM(amount), 0) AS total
         FROM payments
         WHERE restaurant_id = ? AND payment_status = 'Success' AND deleted_at IS NULL
           AND DATE(payment_date) = ?
         GROUP BY payment_method`,
        [restaurantId, date]
    );

    let cash = 0, card = 0, upi = 0, other = 0;
    for (const r of rows) {
        const m = String(r.method || "").toLowerCase();
        const amt = money(r.total);
        if (m === "cash") cash += amt;
        else if (m === "card") card += amt;
        else if (m === "upi") upi += amt;
        else other += amt;               // Wallet, Bank Transfer, Split, …
    }

    return {
        business_date: date,
        bill_count: Number(o.bills) || 0,
        gross_sales: money(o.gross_sales),
        discount_total: money(o.discount_total),
        tax_total: money(o.tax_total),
        net_sales: money(o.net_sales),
        cash_total: money(cash),
        card_total: money(card),
        upi_total: money(upi),
        other_total: money(other),
        collected_total: money(cash + card + upi + other)
    };
}

// The day-record for `date` (open or closed), or null if the day never started.
async function getRow(restaurantId, date) {
    const [[row]] = await db.query(
        `SELECT dc.*, u.full_name AS closed_by_name
         FROM day_closures dc
         LEFT JOIN users u ON u.id = dc.closed_by
         WHERE dc.restaurant_id = ? AND dc.business_date = ? AND dc.deleted_at IS NULL
         ORDER BY dc.id DESC LIMIT 1`,
        [restaurantId, date]
    );
    return row || null;
}

// Open `date` for business. Idempotent: returns the existing row if the day was
// already opened (or closed).
async function openDay(restaurantId, date, userId) {
    const existing = await getRow(restaurantId, date);
    if (existing) return existing;
    await db.query(
        `INSERT INTO day_closures (restaurant_id, business_date, status, opened_by, opened_at)
         VALUES (?, ?, 'open', ?, NOW())`,
        [restaurantId, date, userId || null]
    );
    return getRow(restaurantId, date);
}

// Close `date`: snapshot the day's totals onto its row and mark it closed.
// Idempotent — returns the existing closure if already closed. Creates the row
// if the day was closed without ever being formally opened.
async function closeDay(restaurantId, date, userId, opts = {}) {
    const row = await getRow(restaurantId, date);
    if (row && row.status === "closed") return { closure: row, alreadyClosed: true };

    const s = await getDaySummary(restaurantId, date);
    const counted = opts.counted_cash === "" || opts.counted_cash == null
        ? null : money(opts.counted_cash);
    const variance = counted == null ? null : money(counted - s.cash_total);
    const notes = opts.notes ? String(opts.notes).slice(0, 500) : null;

    if (row) {
        await db.query(
            `UPDATE day_closures SET
                bill_count=?, gross_sales=?, discount_total=?, tax_total=?, net_sales=?,
                cash_total=?, card_total=?, upi_total=?, other_total=?,
                counted_cash=?, cash_variance=?, notes=?, status='closed',
                closed_by=?, closed_at=NOW()
             WHERE id=? AND restaurant_id=?`,
            [s.bill_count, s.gross_sales, s.discount_total, s.tax_total, s.net_sales,
             s.cash_total, s.card_total, s.upi_total, s.other_total,
             counted, variance, notes, userId || null, row.id, restaurantId]
        );
    } else {
        await db.query(
            `INSERT INTO day_closures
                (restaurant_id, business_date, bill_count, gross_sales, discount_total,
                 tax_total, net_sales, cash_total, card_total, upi_total, other_total,
                 counted_cash, cash_variance, notes, status, closed_by, closed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'closed', ?, NOW())`,
            [restaurantId, date, s.bill_count, s.gross_sales, s.discount_total,
             s.tax_total, s.net_sales, s.cash_total, s.card_total, s.upi_total,
             s.other_total, counted, variance, notes, userId || null]
        );
    }
    return { closure: await getRow(restaurantId, date), alreadyClosed: false };
}

// The earliest PAST day with sales that was never CLOSED — the one the next
// person to open the till must clear first. null when caught up.
async function getPendingUnclosed(restaurantId) {
    const [[row]] = await db.query(
        `SELECT DATE(o.created_at) AS d
         FROM orders o
         WHERE o.restaurant_id = ? AND o.payment_status = 'Paid'
           AND o.order_status <> 'Cancelled' AND o.deleted_at IS NULL
           AND DATE(o.created_at) < CURDATE()
           AND NOT EXISTS (
               SELECT 1 FROM day_closures dc
               WHERE dc.restaurant_id = o.restaurant_id
                 AND dc.business_date = DATE(o.created_at)
                 AND dc.status = 'closed' AND dc.deleted_at IS NULL
           )
         GROUP BY DATE(o.created_at)
         ORDER BY d ASC
         LIMIT 1`,
        [restaurantId]
    );
    if (!row) return null;
    const d = row.d instanceof Date
        ? `${row.d.getFullYear()}-${String(row.d.getMonth() + 1).padStart(2, "0")}-${String(row.d.getDate()).padStart(2, "0")}`
        : String(row.d);
    return d;
}

// The state the POS opens against: today's open/closed status + any pending
// past day to close first.
async function getState(restaurantId, today) {
    const row = await getRow(restaurantId, today);
    const pending = await getPendingUnclosed(restaurantId);
    return {
        date: today,
        status: row ? row.status : "none",   // 'none' | 'open' | 'closed'
        is_open: Boolean(row && row.status === "open"),
        is_closed: Boolean(row && row.status === "closed"),
        pending_date: pending
    };
}

// Past closures for the reports/history screen.
async function getClosures(restaurantId, from, to) {
    const [rows] = await db.query(
        `SELECT dc.*, u.full_name AS closed_by_name
         FROM day_closures dc
         LEFT JOIN users u ON u.id = dc.closed_by
         WHERE dc.restaurant_id = ? AND dc.status = 'closed' AND dc.deleted_at IS NULL
           AND dc.business_date BETWEEN ? AND ?
         ORDER BY dc.business_date DESC`,
        [restaurantId, from, to]
    );
    return rows;
}

module.exports = {
    getDaySummary, getRow, openDay, closeDay, getPendingUnclosed, getState, getClosures
};
