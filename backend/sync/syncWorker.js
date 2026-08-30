const db = require("../config/db").promise();
const { UP_TABLES, DOWN_TABLES, BY_TABLE } = require("./syncTables");
const {
    serializeRows,
    applyRows,
    getUnsyncedUp,
    markSynced
} = require("./syncEngine");
const cfg = require("./syncConfig");
const localActivation = require("./localActivation");

let lastSyncAt = null;
let lastError = null;
let restaurantUuid = null;
let activeSyncKey = cfg.syncKey; // overridden by the activated key at startup

async function getRestaurantUuid() {
    if (restaurantUuid) return restaurantUuid;
    // Prefer the identity from activation; fall back to the local restaurants row.
    const stored = await localActivation.getStored();
    if (stored && stored.restaurant_uuid) {
        restaurantUuid = stored.restaurant_uuid;
        return restaurantUuid;
    }
    const [[r]] = await db.query("SELECT uuid FROM restaurants ORDER BY id LIMIT 1");
    restaurantUuid = r ? r.uuid : null;
    return restaurantUuid;
}

async function getCursor(table) {
    const [[row]] = await db.query(
        "SELECT last_pulled_at FROM sync_state WHERE table_name = ? LIMIT 1",
        [table]
    );
    return row ? row.last_pulled_at : null;
}

async function setCursor(table, ts) {
    await db.query(
        `INSERT INTO sync_state (table_name, last_pulled_at) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE last_pulled_at = VALUES(last_pulled_at)`,
        [table, ts]
    );
}

function toDbDate(v) {
    // Hand MySQL a plain 'YYYY-MM-DD HH:MM:SS' in local wall-clock, whether the
    // input is a Date, an ISO string (…T…Z), or already a MySQL string.
    if (!v) return null;
    const fmt = (d) => {
        const p = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
               `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };
    if (v instanceof Date) return fmt(v);
    const s = String(v);
    return s.includes("T") ? fmt(new Date(s)) : s;
}

async function apiPost(path, body) {
    const resp = await fetch(cfg.cloudUrl + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sync-key": activeSyncKey },
        body: JSON.stringify(body)
    });
    return resp.json();
}

async function apiGet(path, params) {
    const qs = new URLSearchParams(params).toString();
    const resp = await fetch(`${cfg.cloudUrl}${path}?${qs}`, {
        headers: { "x-sync-key": activeSyncKey }
    });
    return resp.json();
}

async function pushUp() {
    const ruuid = await getRestaurantUuid();
    for (const table of UP_TABLES) {
        const def = BY_TABLE[table];
        const rows = await getUnsyncedUp(db, def);
        if (!rows.length) continue;
        const payload = await serializeRows(db, def, rows);
        const resp = await apiPost("/api/sync/push", {
            table,
            rows: payload,
            restaurant_uuid: ruuid
        });
        if (resp && resp.success) {
            await markSynced(db, table, rows.map((r) => r.uuid));
        } else {
            throw new Error(`push ${table}: ${resp && resp.message}`);
        }
    }
}

async function pullDown() {
    const ruuid = await getRestaurantUuid();
    for (const table of DOWN_TABLES) {
        const def = BY_TABLE[table];
        const since = await getCursor(table);
        const resp = await apiGet("/api/sync/pull", {
            table,
            since: toDbDate(since) || "",
            restaurant_uuid: ruuid || ""
        });
        if (resp && resp.success) {
            if (resp.rows && resp.rows.length) {
                await applyRows(db, def, resp.rows);
            }
            await setCursor(table, toDbDate(resp.serverTime));
        } else {
            throw new Error(`pull ${table}: ${resp && resp.message}`);
        }
    }
}

async function cycle() {
    try {
        await pushUp();
        await pullDown();
        lastSyncAt = new Date();
        lastError = null;
    } catch (e) {
        // Offline or transient — stay quiet, the next cycle retries.
        lastError = e.message;
    }
}

async function start() {
    if (!cfg.isLocal) return;
    if (!cfg.cloudUrl) {
        console.warn("Sync worker not started: CLOUD_SYNC_URL missing.");
        return;
    }

    // First run: activate this machine, which yields the restaurant identity and
    // the machine sync key. Then the first cycle's pull (empty cursors) brings
    // the whole catalog down.
    try {
        const act = await localActivation.ensureActivated();
        if (act && act.sync_key) {
            activeSyncKey = act.sync_key;
            restaurantUuid = act.restaurant_uuid;
        }
    } catch (e) {
        console.error("Activation error (will retry on next boot):", e.message);
    }

    if (!activeSyncKey) {
        console.warn("Sync worker idle: not activated and no dev SYNC_KEY set.");
        return;
    }

    console.log(`🔁 Sync worker started (every ${cfg.intervalMs / 1000}s -> ${cfg.cloudUrl})`);
    cycle();
    setInterval(cycle, cfg.intervalMs);
}

module.exports = {
    start,
    cycle,
    getStatus: () => ({ lastSyncAt, lastError })
};
