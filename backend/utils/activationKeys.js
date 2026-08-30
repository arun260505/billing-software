const crypto = require("crypto");

// Human-typable activation key, e.g. INWZ-4K2P-9XQR (no I/O/0/1 to avoid confusion).
function genActivationKey() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const block = () =>
        Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
    return `INWZ-${block()}-${block()}`;
}

// Long random machine credential used on the sync channel.
function genSyncKey() {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * Ensure a restaurant has an activation record; returns its activation key.
 * Idempotent — returns the existing key if one is already present.
 * `dbp` is a promise-wrapped mysql2 connection/pool.
 */
async function ensureActivationRecord(dbp, restaurantId) {
    const [[existing]] = await dbp.query(
        "SELECT activation_key FROM restaurant_activations WHERE restaurant_id = ? LIMIT 1",
        [restaurantId]
    );
    if (existing) return existing.activation_key;

    const key = genActivationKey();
    await dbp.query(
        "INSERT INTO restaurant_activations (restaurant_id, activation_key, sync_key) VALUES (?, ?, ?)",
        [restaurantId, key, genSyncKey()]
    );
    return key;
}

module.exports = { genActivationKey, genSyncKey, ensureActivationRecord };
