const db = require("../config/db").promise();

/*
| Owner alerts feed.
|
| A small append-only log of things the salon owner wants to hear about from their
| phone: the day being opened / closed, the closing sales summary, and stock
| dropping to its reorder level. Every alert is one `notifications` row.
|
| WHY THIS TABLE SYNCS UP (till -> cloud)
|   These events happen at the till (the receptionist opens the day, rings sales,
|   moves stock). The owner's phone app runs on ANY network and reads the CLOUD,
|   so the events have to travel from the till up to the cloud — hence the table
|   is registered as an UP-sync table (see sync/syncTables.js). An event raised on
|   the cloud itself (owner editing stock on the web) is already where the app
|   reads it. Either way the app sees every alert.
|
| Alerts are advisory. Raising one must never break the thing that triggered it
| (a day close, a payment), so every write goes through notifySafe(), which
| swallows its own errors.
*/

const TYPES = {
    SHOP_OPEN: "shop_open",
    SHOP_CLOSE: "shop_close",
    DAILY_SUMMARY: "daily_summary",
    LOW_STOCK: "low_stock",
    OUT_OF_STOCK: "out_of_stock",
};

// Insert one alert. `meta` is any small object; stored as JSON text so the app
// can render richer content (e.g. the day's tender split) without new columns.
async function notify(restaurantId, { type, title, body = null, meta = null, dedup_key = null }) {
    if (!restaurantId || !type || !title) return;

    // Light de-duplication: if an identical still-live alert with the same
    // dedup_key was raised in the last 6 hours, don't raise it again. Guards
    // against a retry or a double-tap producing two "Day opened" pings.
    if (dedup_key) {
        const [[dupe]] = await db.query(
            `SELECT id FROM notifications
             WHERE restaurant_id = ? AND dedup_key = ? AND deleted_at IS NULL
               AND created_at > (NOW() - INTERVAL 6 HOUR)
             LIMIT 1`,
            [restaurantId, dedup_key]
        );
        if (dupe) return;
    }

    await db.query(
        `INSERT INTO notifications (restaurant_id, type, title, body, meta, dedup_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [restaurantId, type, title, body, meta ? JSON.stringify(meta) : null, dedup_key]
    );
}

// Fire-and-forget: never rejects, so a caller can `await` it inside a business
// flow without a failed alert ever taking that flow down.
async function notifySafe(restaurantId, payload) {
    try {
        await notify(restaurantId, payload);
    } catch (e) {
        console.error("notification failed:", e.message);
    }
}

// Raise a low / out-of-stock alert when an item has just CROSSED its reorder
// level on this stock move (was above, now at/below). Passing the before and
// after quantities means the alert fires once per depletion, not on every sale
// while it stays low. Safe to call from anywhere.
async function lowStockIfCrossed(restaurantId, item, before, after) {
    try {
        const min = Number(item.min_quantity);
        if (!Number.isFinite(min)) return;
        const wasOk = Number(before) > min;
        const nowLow = Number(after) <= min;
        if (!(wasOk && nowLow)) return;

        const unit = item.unit || "pcs";
        const out = Number(after) <= 0;
        await notifySafe(restaurantId, {
            type: out ? TYPES.OUT_OF_STOCK : TYPES.LOW_STOCK,
            title: out ? `Out of stock: ${item.item_name}` : `Low stock: ${item.item_name}`,
            body: out
                ? `${item.item_name} has run out. Reorder to keep selling it.`
                : `${item.item_name} is down to ${after} ${unit} (reorder at ${min}).`,
            meta: {
                item_name: item.item_name,
                quantity: Number(after),
                reorder_level: min,
                unit,
            },
            // One live alert per item until it's restocked above the level again
            // (which ends this "low" spell, so the next crossing raises a fresh one).
            dedup_key: `${out ? "out" : "low"}:${item.id}`,
        });
    } catch (e) {
        console.error("low-stock alert failed:", e.message);
    }
}

// The feed for the owner app: newest first, only alerts after `sinceId` (0 = all).
async function list(restaurantId, { sinceId = 0, limit = 50 } = {}) {
    const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const after = Number(sinceId) || 0;
    const [rows] = await db.query(
        `SELECT id, type, title, body, meta, created_at
         FROM notifications
         WHERE restaurant_id = ? AND deleted_at IS NULL AND id > ?
         ORDER BY id DESC
         LIMIT ?`,
        [restaurantId, after, cap]
    );
    return rows.map((r) => ({
        ...r,
        meta: r.meta ? safeParse(r.meta) : null,
    }));
}

function safeParse(s) {
    try { return JSON.parse(s); } catch { return null; }
}

module.exports = { TYPES, notify, notifySafe, lowStockIfCrossed, list };
