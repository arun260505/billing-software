const db = require("../config/db").promise();

/*
| Open / close the BUSINESS day (cash-up / Z-report).
|
| A business day runs from when it is OPENED until it is CLOSED — not midnight to
| midnight. So a sale rung at 12:05am on a day that is still open counts for that
| (previous) day, and reopening a day just closed continues the SAME day. Because
| a new day cannot start until the current one is closed, the day windows are
| disjoint: one day's sales can never collide with the next day's.
|
| Each day is one day_closures row: opened_at set on open, closed_at + a snapshot
| of the totals set on close. Sales come from orders (Paid, not cancelled) whose
| created_at falls in the day's window; the tender split from payments the same way.
*/

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

function ymd(d) {
    const x = d instanceof Date ? d : new Date(d);
    if (isNaN(x)) return String(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

// The start of a day's window: its opened_at, or (legacy rows) midnight of its date.
function windowStart(row) {
    return row.opened_at || `${ymd(row.business_date)} 00:00:00`;
}

// Totals for a time window [from, to). `to` null = up to now.
async function summaryForWindow(restaurantId, from, to) {
    const oTo = to ? "AND o.created_at < ?" : "";
    const pTo = to ? "AND p.payment_date < ?" : "";
    const oParams = to ? [restaurantId, from, to] : [restaurantId, from];
    const pParams = to ? [restaurantId, from, to] : [restaurantId, from];

    const [[o]] = await db.query(
        `SELECT COUNT(*) AS bills,
                IFNULL(SUM(subtotal), 0)                  AS gross_sales,
                IFNULL(SUM(discount), 0)                  AS discount_total,
                IFNULL(SUM(tax) + SUM(service_charge), 0) AS tax_total,
                IFNULL(SUM(grand_total), 0)               AS net_sales
         FROM orders o
         WHERE o.restaurant_id = ? AND o.payment_status = 'Paid'
           AND o.order_status <> 'Cancelled' AND o.deleted_at IS NULL
           AND o.created_at >= ? ${oTo}`,
        oParams
    );

    const [rows] = await db.query(
        `SELECT p.payment_method AS method, IFNULL(SUM(p.amount), 0) AS total
         FROM payments p
         WHERE p.restaurant_id = ? AND p.payment_status = 'Success' AND p.deleted_at IS NULL
           AND p.payment_date >= ? ${pTo}
         GROUP BY p.payment_method`,
        pParams
    );

    let cash = 0, card = 0, upi = 0, other = 0;
    for (const r of rows) {
        const m = String(r.method || "").toLowerCase();
        const amt = money(r.total);
        if (m === "cash") cash += amt;
        else if (m === "card") card += amt;
        else if (m === "upi") upi += amt;
        else other += amt;
    }

    return {
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

// The active (open) business day, or null.
async function getOpenDay(restaurantId) {
    const [[row]] = await db.query(
        `SELECT dc.*, uo.full_name AS opened_by_name
         FROM day_closures dc
         LEFT JOIN users uo ON uo.id = dc.opened_by
         WHERE dc.restaurant_id = ? AND dc.status = 'open' AND dc.deleted_at IS NULL
         ORDER BY dc.opened_at DESC, dc.id DESC
         LIMIT 1`,
        [restaurantId]
    );
    return row || null;
}

// The most recent day row (open or closed).
async function getLatest(restaurantId) {
    const [[row]] = await db.query(
        `SELECT dc.*, u.full_name AS closed_by_name
         FROM day_closures dc
         LEFT JOIN users u ON u.id = dc.closed_by
         WHERE dc.restaurant_id = ? AND dc.deleted_at IS NULL
         ORDER BY COALESCE(dc.closed_at, dc.opened_at) DESC, dc.id DESC
         LIMIT 1`,
        [restaurantId]
    );
    return row || null;
}

async function getRowById(restaurantId, id) {
    const [[row]] = await db.query(
        `SELECT dc.*, u.full_name AS closed_by_name
         FROM day_closures dc
         LEFT JOIN users u ON u.id = dc.closed_by
         WHERE dc.restaurant_id = ? AND dc.id = ? AND dc.deleted_at IS NULL`,
        [restaurantId, id]
    );
    return row || null;
}

// Running totals for a day row (the live window for an open day, the frozen
// window for a closed one), with its identity.
async function summaryOf(restaurantId, row) {
    if (!row) return null;
    const s = await summaryForWindow(restaurantId, windowStart(row), row.status === "closed" ? row.closed_at : null);
    return {
        ...s,
        business_date: ymd(row.business_date),
        opened_at: row.opened_at,
        closed_at: row.closed_at,
        status: row.status
    };
}

// Open the day, or CONTINUE one that is already running / was just closed today.
// A fresh day is only started when the previous one is closed and belongs to an
// earlier date — which is what keeps the windows from colliding.
async function openDay(restaurantId, userId, today) {
    const open = await getOpenDay(restaurantId);
    if (open) return open;                       // already running — continue it

    const latest = await getLatest(restaurantId);
    if (latest && latest.status === "closed" && ymd(latest.business_date) === today) {
        // Closed by accident earlier today — reopen the SAME day (keep opened_at).
        await db.query("UPDATE day_closures SET status = 'open', closed_at = NULL WHERE id = ?", [latest.id]);
        return getRowById(restaurantId, latest.id);
    }

    await db.query(
        `INSERT INTO day_closures (restaurant_id, business_date, status, opened_by, opened_at)
         VALUES (?, ?, 'open', ?, NOW())`,
        [restaurantId, today, userId || null]
    );
    return getOpenDay(restaurantId);
}

// Close the active open day: snapshot its window totals and mark it closed.
async function closeDay(restaurantId, userId, opts = {}) {
    const open = await getOpenDay(restaurantId);
    if (!open) {
        return { alreadyClosed: true, closure: await getLatest(restaurantId), summary: null };
    }

    const s = await summaryForWindow(restaurantId, windowStart(open), null);
    const counted = opts.counted_cash === "" || opts.counted_cash == null ? null : money(opts.counted_cash);
    const variance = counted == null ? null : money(counted - s.cash_total);
    const notes = opts.notes ? String(opts.notes).slice(0, 500) : null;

    await db.query(
        `UPDATE day_closures SET
            bill_count=?, gross_sales=?, discount_total=?, tax_total=?, net_sales=?,
            cash_total=?, card_total=?, upi_total=?, other_total=?,
            counted_cash=?, cash_variance=?, notes=?, status='closed',
            closed_by=?, closed_at=NOW()
         WHERE id=?`,
        [s.bill_count, s.gross_sales, s.discount_total, s.tax_total, s.net_sales,
         s.cash_total, s.card_total, s.upi_total, s.other_total,
         counted, variance, notes, userId || null, open.id]
    );

    const closure = await getRowById(restaurantId, open.id);
    return { alreadyClosed: false, closure, summary: await summaryOf(restaurantId, closure) };
}

// The state the POS / dashboard reads:
//   is_open      a day is currently running
//   active_date  that day's business date (when it was opened)
//   stale        it was opened on an earlier date and never closed — nudge to close
//   started_today a day for today has already been closed (POS should open again)
//   summary      running totals for the open window (null when nothing is open)
async function getState(restaurantId, today) {
    const open = await getOpenDay(restaurantId);
    if (open) {
        const openDate = ymd(open.business_date);
        return {
            today,
            is_open: true,
            is_closed: false,
            active_date: openDate,
            opened_at: open.opened_at,
            stale: openDate < today,
            summary: await summaryForWindow(restaurantId, windowStart(open), null)
        };
    }
    const latest = await getLatest(restaurantId);
    const startedToday = Boolean(latest && ymd(latest.business_date) === today);
    return {
        today,
        is_open: false,
        is_closed: startedToday,          // today was opened & already closed
        active_date: null,
        last_closed_date: latest ? ymd(latest.business_date) : null,
        started_today: startedToday,
        stale: false,
        summary: null
    };
}

// Past closures for the reports / history screen.
async function getClosures(restaurantId, from, to) {
    const [rows] = await db.query(
        `SELECT dc.*, u.full_name AS closed_by_name
         FROM day_closures dc
         LEFT JOIN users u ON u.id = dc.closed_by
         WHERE dc.restaurant_id = ? AND dc.status = 'closed' AND dc.deleted_at IS NULL
           AND dc.business_date BETWEEN ? AND ?
         ORDER BY dc.business_date DESC, dc.id DESC`,
        [restaurantId, from, to]
    );
    return rows;
}

module.exports = {
    summaryForWindow, getOpenDay, getLatest, getRowById, summaryOf,
    openDay, closeDay, getState, getClosures
};
