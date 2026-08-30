const db = require("../config/db").promise();
const { BY_TABLE } = require("../sync/syncTables");
const { applyRows, serializeRows, getChangedSince } = require("../sync/syncEngine");
const { syncKey } = require("../sync/syncConfig");

// Machine credential check for the push/pull channel (not a staff login).
// A request is authorised if it presents either the global dev key (SYNC_KEY
// env, used in single-tenant/testing) OR the per-restaurant sync key issued at
// activation for the restaurant it names.
async function keyOk(req, res, restaurantUuid) {
    const provided = req.headers["x-sync-key"];
    if (!provided) {
        res.status(401).json({ success: false, message: "Missing sync key." });
        return false;
    }
    if (syncKey && provided === syncKey) return true;

    if (restaurantUuid) {
        const [[r]] = await db.query(
            "SELECT id FROM restaurants WHERE uuid = ? LIMIT 1",
            [restaurantUuid]
        );
        if (r) {
            const [[a]] = await db.query(
                "SELECT sync_key FROM restaurant_activations WHERE restaurant_id = ? LIMIT 1",
                [r.id]
            );
            if (a && a.sync_key === provided) return true;
        }
    }

    res.status(401).json({ success: false, message: "Invalid sync key." });
    return false;
}

async function recordHeartbeat(restaurantUuid) {
    if (!restaurantUuid) return;
    await db.query(
        `INSERT INTO sync_status (restaurant_uuid, last_sync_at)
         VALUES (?, NOW())
         ON DUPLICATE KEY UPDATE last_sync_at = NOW()`,
        [restaurantUuid]
    );
}

// POST /api/sync/push  { table, rows, restaurant_uuid }
exports.push = async (req, res) => {
    const { table, rows, restaurant_uuid } = req.body || {};
    if (!(await keyOk(req, res, restaurant_uuid))) return;
    const def = BY_TABLE[table];
    if (!def || def.direction !== "up") {
        return res.status(400).json({ success: false, message: "Not an up-sync table." });
    }
    try {
        const result = await applyRows(db, def, rows || []);
        await recordHeartbeat(restaurant_uuid);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// GET /api/sync/pull?table=X&since=T&restaurant_uuid=U
exports.pull = async (req, res) => {
    const { table, since, restaurant_uuid } = req.query;
    if (!(await keyOk(req, res, restaurant_uuid))) return;
    const def = BY_TABLE[table];
    if (!def || def.direction !== "down") {
        return res.status(400).json({ success: false, message: "Not a down-sync table." });
    }
    try {
        let scope = {};
        if (restaurant_uuid) {
            const [[r]] = await db.query(
                "SELECT id FROM restaurants WHERE uuid = ? LIMIT 1",
                [restaurant_uuid]
            );
            scope = { restaurantId: r ? r.id : -1, restaurantUuid: restaurant_uuid };
        }
        const rows = await getChangedSince(db, def, since, scope);
        const payload = await serializeRows(db, def, rows);
        // Plain MySQL DATETIME string (not a Date) for the receiver's next cursor.
        const [[t]] = await db.query(
            "SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS now"
        );
        res.json({ success: true, rows: payload, serverTime: t.now });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// GET /api/sync/status — for the admin "last synced" badge. Scoped to the
// logged-in user's restaurant. last_sync_at is null when no local node has ever
// synced (e.g. a pure cloud deployment), so the UI can hide the badge.
exports.status = async (req, res) => {
    try {
        const rid = req.user && req.user.restaurant_id;
        if (!rid) return res.json({ success: true, last_sync_at: null });

        const [[r]] = await db.query(
            "SELECT uuid FROM restaurants WHERE id = ? LIMIT 1",
            [rid]
        );
        if (!r) return res.json({ success: true, last_sync_at: null });

        const [[row]] = await db.query(
            "SELECT last_sync_at FROM sync_status WHERE restaurant_uuid = ? LIMIT 1",
            [r.uuid]
        );
        res.json({ success: true, last_sync_at: row ? row.last_sync_at : null });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
