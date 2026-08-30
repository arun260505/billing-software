const crypto = require("crypto");
const db = require("../config/db").promise();
const cfg = require("./syncConfig");

// Ensure the single activation row exists, with a stable random machine_id
// generated once and reused across restarts.
async function ensureRow() {
    await db.query(
        "INSERT IGNORE INTO activation (id, machine_id) VALUES (1, ?)",
        [crypto.randomUUID()]
    );
}

async function getStored() {
    const [[row]] = await db.query("SELECT * FROM activation WHERE id = 1 LIMIT 1");
    return row || null;
}

/*
 * On a fresh local node: exchange the installer-supplied ACTIVATION_KEY for this
 * restaurant's identity (uuid) and machine sync key, and remember them. Once
 * activated, returns the stored record without calling the cloud again.
 * Returns null if activation isn't possible/needed (missing key or cloud URL).
 */
async function ensureActivated() {
    await ensureRow();
    let row = await getStored();

    if (row && row.restaurant_uuid && row.sync_key) {
        return row; // already activated
    }

    const activationKey = process.env.ACTIVATION_KEY;
    if (!cfg.cloudUrl || !activationKey) {
        return null; // nothing to activate against
    }

    const resp = await fetch(cfg.cloudUrl + "/api/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            activation_key: activationKey,
            machine_id: row.machine_id
        })
    }).then((r) => r.json());

    if (!resp || !resp.success) {
        throw new Error("activation failed: " + (resp && resp.message));
    }

    await db.query(
        "UPDATE activation SET restaurant_uuid = ?, sync_key = ?, activated_at = NOW() WHERE id = 1",
        [resp.restaurant_uuid, resp.sync_key]
    );
    console.log(`✅ Activated as "${resp.restaurant_name}" (${resp.restaurant_uuid})`);
    return getStored();
}

module.exports = { ensureActivated, getStored };
