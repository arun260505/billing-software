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
            // Mark synced ONLY the rows the server actually wrote. A row it
            // deferred (its parent hasn't synced yet) or rejected must stay
            // unsynced so the next cycle retries it once the dependency arrives —
            // marking it synced here would drop it from the cloud with no error.
            // Fall back to all uuids for an older server that doesn't ack per row.
            const acked = Array.isArray(resp.appliedUuids)
                ? resp.appliedUuids
                : rows.map((r) => r.uuid);
            await markSynced(db, table, acked);
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
    // Push and pull independently: a failing push (e.g. one bad order) must not
    // block pulling the admin's menu/category/table changes down.
    let ok = true;
    try {
        await pushUp();
    } catch (e) {
        lastError = "push: " + e.message;
        ok = false;
    }
    try {
        await pullDown();
    } catch (e) {
        lastError = "pull: " + e.message;
        ok = false;
    }
    if (ok) {
        lastSyncAt = new Date();
        lastError = null;
    }
}

async function start() {
    if (!cfg.isLocal) return;
    if (!cfg.cloudUrl) {
        console.warn("Sync worker not started: CLOUD_SYNC_URL missing.");
        return;
    }

    // Activate this machine (yields the restaurant identity + machine sync key),
    // then the first cycle's pull (empty cursors) brings the whole catalog down.
    //
    // Activation can fail at boot if MySQL isn't accepting connections yet (the DB
    // service is still doing InnoDB recovery). Previously the worker logged
    // "idle: not activated" and RETURNED - giving up until the next reboot, which
    // stranded every bill rung after that on the till with no sync. Now it keeps
    // retrying activation every interval, so the worker self-heals the moment the
    // DB (and cloud) are reachable - no restart needed.
    const begin = () => {
        console.log(`🔁 Sync worker started (every ${cfg.intervalMs / 1000}s -> ${cfg.cloudUrl})`);
        cycle();
        setInterval(cycle, cfg.intervalMs);
    };

    const tryActivate = async () => {
        if (activeSyncKey) return true;              // dev SYNC_KEY, or already activated
        try {
            const act = await localActivation.ensureActivated();
            if (act && act.sync_key) {
                activeSyncKey = act.sync_key;
                restaurantUuid = act.restaurant_uuid;
                return true;
            }
        } catch (e) {
            lastError = "activation: " + e.message;
        }
        return false;
    };

    if (await tryActivate()) { begin(); return; }

    console.warn(`Sync worker: not activated yet (MySQL/cloud not ready?) - retrying every ${cfg.intervalMs / 1000}s...`);
    const retry = setInterval(async () => {
        if (await tryActivate()) {
            clearInterval(retry);
            begin();
        }
    }, cfg.intervalMs);
}

module.exports = {
    start,
    cycle,
    getStatus: () => ({ lastSyncAt, lastError })
};
