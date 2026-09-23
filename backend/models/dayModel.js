const db = require("../config/db").promise();
const notify = require("./notificationModel");

const rupee = (n) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN")}`;

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
| of the totals set on close. A day's sales are the orders (Paid, not cancelled)
| whose created_at falls in [opened_at, closed_at) — compared ENTIRELY in SQL, so
| the server's timezone can't skew the window (comparing a JS Date round-tripped
| through the driver was the bug that made totals read low/zero).
*/

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

function ymd(d) {
    // Already a 'YYYY-MM-DD' string (the queries below format business_date this
    // way): use it as-is. Re-parsing it into a JS Date and reading it back drifts
    // by a day whenever the driver's timezone (DB_TIMEZONE=+05:30 on the cloud)
    // and the Node process timezone (UTC on the cloud) disagree — which is what
    // made a day dated today read as "yesterday" and loop the close prompt.
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    const x = d instanceof Date ? d : new Date(d);
    if (isNaN(x)) return String(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

// More than one row can be "open" at once — from testing/races, or when a stale
// open day left on one machine (or the cloud) collides with the real current day
// opened on another. Keep the MOST RECENTLY opened one (that's the day the
// counter is actually on now) and retire the older stragglers, so there is always
// exactly one open day and it's the current one. (Keeping the earliest instead
// once made the cloud cling to a stale day and bucket today's sales under it.)
async function consolidateOpens(restaurantId) {
    // Self-heal orphaned open days first. Business days are sequential and
    // disjoint, so an OPEN day cannot be OLDER than one that is already CLOSED —
    // you can't close a later day while an earlier one is still running. That
    // only happens when opens/closes from more than one till or database sync up
    // and collide on the cloud (e.g. one machine closed today while another left
    // an earlier day open). Such an open row is a stale orphan: retire it so the
    // shop's real state comes from the latest day, and the owner doesn't see
    // "Shop open" after the counter has closed the current day.
    await db.query(
        `UPDATE day_closures o
         JOIN (
             SELECT MAX(business_date) AS d
             FROM day_closures
             WHERE restaurant_id = ? AND status = 'closed' AND deleted_at IS NULL
         ) c
         SET o.status = 'closed', o.closed_at = COALESCE(o.closed_at, NOW())
         WHERE o.restaurant_id = ? AND o.status = 'open' AND o.deleted_at IS NULL
           AND c.d IS NOT NULL AND o.business_date < c.d`,
        [restaurantId, restaurantId]
    );

    const [opens] = await db.query(
        `SELECT id FROM day_closures
         WHERE restaurant_id = ? AND status = 'open' AND deleted_at IS NULL
         ORDER BY opened_at DESC, id DESC`,
        [restaurantId]
    );
    if (opens.length > 1) {
        const keep = opens[0].id;
        await db.query(
            `UPDATE day_closures SET deleted_at = NOW()
             WHERE restaurant_id = ? AND status = 'open' AND deleted_at IS NULL AND id <> ?`,
            [restaurantId, keep]
        );
    }
    return opens.length ? opens[0].id : null;
}

// The day's totals + tender split, windowed by the day row's own opened_at /
// closed_at — the comparison stays in SQL so timezone can't shift it.
async function summaryForDay(restaurantId, dayId) {
    const [[o]] = await db.query(
        `SELECT
            COUNT(o.id)                                   AS bills,
            IFNULL(SUM(o.subtotal), 0)                    AS gross_sales,
            IFNULL(SUM(o.discount), 0)                    AS discount_total,
            IFNULL(IFNULL(SUM(o.tax),0) + IFNULL(SUM(o.service_charge),0), 0) AS tax_total,
            IFNULL(SUM(o.grand_total), 0)                 AS net_sales
         FROM day_closures dc
         LEFT JOIN orders o
             ON o.restaurant_id = dc.restaurant_id
            AND o.payment_status = 'Paid'
            AND o.order_status <> 'Cancelled'
            AND o.deleted_at IS NULL
            AND o.created_at >= COALESCE(dc.opened_at, dc.business_date)
            AND (dc.closed_at IS NULL OR o.created_at < dc.closed_at)
         WHERE dc.id = ? AND dc.restaurant_id = ?`,
        [dayId, restaurantId]
    );

    // Tender split — counted only for orders that are actually Paid (not Pending
    // or Cancelled) and fall in the day's window. Tying payments to finalized
    // orders this way keeps "collected" equal to "net" even if a stray/half-
    // settled payment ever exists, so the cash-up can't drift.
    const [rows] = await db.query(
        `SELECT p.payment_method AS method, IFNULL(SUM(p.amount), 0) AS total
         FROM day_closures dc
         JOIN orders o
             ON o.restaurant_id = dc.restaurant_id
            AND o.payment_status = 'Paid'
            AND o.order_status <> 'Cancelled'
            AND o.deleted_at IS NULL
            AND o.created_at >= COALESCE(dc.opened_at, dc.business_date)
            AND (dc.closed_at IS NULL OR o.created_at < dc.closed_at)
         JOIN payments p
             ON p.order_id = o.id
            AND p.payment_status = 'Success'
            AND p.deleted_at IS NULL
         WHERE dc.id = ? AND dc.restaurant_id = ?
         GROUP BY p.payment_method`,
        [dayId, restaurantId]
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

// The active (open) business day, or null. Consolidates first so it's unique.
async function getOpenDay(restaurantId) {
    await consolidateOpens(restaurantId);
    const [[row]] = await db.query(
        `SELECT dc.*, DATE_FORMAT(dc.business_date, '%Y-%m-%d') AS business_date,
                uo.full_name AS opened_by_name
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
        `SELECT dc.*, DATE_FORMAT(dc.business_date, '%Y-%m-%d') AS business_date,
                u.full_name AS closed_by_name
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
        `SELECT dc.*, DATE_FORMAT(dc.business_date, '%Y-%m-%d') AS business_date,
                u.full_name AS closed_by_name
         FROM day_closures dc
         LEFT JOIN users u ON u.id = dc.closed_by
         WHERE dc.restaurant_id = ? AND dc.id = ? AND dc.deleted_at IS NULL`,
        [restaurantId, id]
    );
    return row || null;
}

// Totals for a day row (live for an open day, frozen for a closed one) + identity.
async function summaryOf(restaurantId, row) {
    if (!row) return null;
    const s = await summaryForDay(restaurantId, row.id);
    return {
        ...s,
        business_date: ymd(row.business_date),
        opened_at: row.opened_at,
        closed_at: row.closed_at,
        status: row.status
    };
}

// Open the day, or CONTINUE one already running / just closed today. A fresh day
// only starts when the previous one is closed and belongs to an earlier date —
// which is what keeps the windows from colliding.
// Opening the day is a fresh start: every item marked "unavailable" (sold out)
// during the previous day becomes available again, so the counter never has to
// re-enable them one by one each morning. Category timing still applies.
async function resetItemsAvailable(restaurantId) {
    try {
        await db.query("UPDATE menu_items SET available = 1 WHERE restaurant_id = ?", [restaurantId]);
    } catch (e) {
        // Never let this block opening the day — it's a convenience, not a gate.
        console.error("resetItemsAvailable failed:", e.message);
    }
}

async function openDay(restaurantId, userId, today) {
    const open = await getOpenDay(restaurantId);   // consolidates duplicates too
    if (open) return open;                          // already open — leave items as they are

    const latest = await getLatest(restaurantId);
    if (latest && latest.status === "closed" && ymd(latest.business_date) === today) {
        await db.query("UPDATE day_closures SET status = 'open', closed_at = NULL WHERE id = ?", [latest.id]);
        await resetItemsAvailable(restaurantId);
        const row = await getRowById(restaurantId, latest.id);
        await announceOpen(restaurantId, row);
        return row;
    }

    await db.query(
        `INSERT INTO day_closures (restaurant_id, business_date, status, opened_by, opened_at)
         VALUES (?, ?, 'open', ?, NOW())`,
        [restaurantId, today, userId || null]
    );
    await resetItemsAvailable(restaurantId);
    const row = await getOpenDay(restaurantId);
    await announceOpen(restaurantId, row);
    return row;
}

// Tell the owner the shop opened. Keyed on the day row so a re-open of the same
// day (or a retry) doesn't ping twice.
async function announceOpen(restaurantId, row) {
    if (!row) return;
    await notify.notifySafe(restaurantId, {
        type: notify.TYPES.SHOP_OPEN,
        title: "Shop opened",
        body: `The day was opened${row.opened_by_name ? ` by ${row.opened_by_name}` : ""}.`,
        meta: { business_date: ymd(row.business_date), opened_at: row.opened_at },
        dedup_key: `shop_open:${row.id}`,
    });
}

// Close the active open day: snapshot its window totals and mark it closed.
async function closeDay(restaurantId, userId, opts = {}) {
    const open = await getOpenDay(restaurantId);
    if (!open) {
        return { alreadyClosed: true, closure: await getLatest(restaurantId), summary: null };
    }

    const s = await summaryForDay(restaurantId, open.id);
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
    const summary = await summaryOf(restaurantId, closure);

    // Two owner alerts on close: a plain "shop closed", and a detailed sales
    // summary. Keyed on the day row so a retry can't double-ping.
    await notify.notifySafe(restaurantId, {
        type: notify.TYPES.SHOP_CLOSE,
        title: "Shop closed",
        body: `The day was closed${closure.closed_by_name ? ` by ${closure.closed_by_name}` : ""}.`,
        meta: { business_date: ymd(closure.business_date), closed_at: closure.closed_at },
        dedup_key: `shop_close:${open.id}`,
    });
    const tender = [
        s.cash_total ? `Cash ${rupee(s.cash_total)}` : null,
        s.card_total ? `Card ${rupee(s.card_total)}` : null,
        s.upi_total ? `UPI ${rupee(s.upi_total)}` : null,
        s.other_total ? `Other ${rupee(s.other_total)}` : null,
    ].filter(Boolean).join(" · ");
    await notify.notifySafe(restaurantId, {
        type: notify.TYPES.DAILY_SUMMARY,
        title: `Day summary: ${rupee(s.collected_total)} collected`,
        body: `${s.bill_count} bill${s.bill_count === 1 ? "" : "s"}, net sales ${rupee(s.net_sales)}.`
            + (tender ? ` ${tender}.` : ""),
        meta: { business_date: ymd(closure.business_date), ...s },
        dedup_key: `daily_summary:${open.id}`,
    });

    return { alreadyClosed: false, closure, summary };
}

// State for the POS / dashboard.
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
            summary: await summaryForDay(restaurantId, open.id)
        };
    }
    const latest = await getLatest(restaurantId);
    const startedToday = Boolean(latest && ymd(latest.business_date) === today);
    return {
        today,
        is_open: false,
        is_closed: startedToday,
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
        `SELECT dc.*, DATE_FORMAT(dc.business_date, '%Y-%m-%d') AS business_date,
                u.full_name AS closed_by_name
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
    summaryForDay, getOpenDay, getLatest, getRowById, summaryOf,
    openDay, closeDay, getState, getClosures
};
