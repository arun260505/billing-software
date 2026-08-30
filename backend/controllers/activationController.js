const crypto = require("crypto");
const db = require("../config/db").promise();

// Human-typable activation key, e.g. INWZ-4K2P-9XQR.
function genActivationKey() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
    const block = () =>
        Array.from({ length: 4 }, () =>
            alphabet[crypto.randomInt(alphabet.length)]
        ).join("");
    return `INWZ-${block()}-${block()}`;
}

// Long random machine credential used on the sync channel (x-sync-key).
function genSyncKey() {
    return crypto.randomBytes(32).toString("hex");
}

// POST /api/activate/generate  (super_admin)  { restaurant_id }
// Creates (or returns the existing) activation key for a restaurant.
exports.generate = async (req, res) => {
    try {
        const rid = req.body.restaurant_id;
        if (!rid) {
            return res.status(400).json({ success: false, message: "restaurant_id required." });
        }
        const [[r]] = await db.query(
            "SELECT id, restaurant_name FROM restaurants WHERE id = ? LIMIT 1",
            [rid]
        );
        if (!r) {
            return res.status(404).json({ success: false, message: "Restaurant not found." });
        }

        const [[existing]] = await db.query(
            "SELECT activation_key, activated_at FROM restaurant_activations WHERE restaurant_id = ? LIMIT 1",
            [rid]
        );

        let activationKey;
        if (existing) {
            activationKey = existing.activation_key;
        } else {
            activationKey = genActivationKey();
            await db.query(
                "INSERT INTO restaurant_activations (restaurant_id, activation_key, sync_key) VALUES (?, ?, ?)",
                [rid, activationKey, genSyncKey()]
            );
        }

        res.json({
            success: true,
            restaurant: r.restaurant_name,
            activation_key: activationKey,
            activated: Boolean(existing && existing.activated_at)
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// POST /api/activate  (public — the installer calls this once)
// { activation_key, machine_id } -> { restaurant_uuid, restaurant_name, sync_key }
exports.activate = async (req, res) => {
    try {
        const { activation_key, machine_id } = req.body || {};
        if (!activation_key) {
            return res.status(400).json({ success: false, message: "activation_key required." });
        }

        const [[a]] = await db.query(
            "SELECT * FROM restaurant_activations WHERE activation_key = ? LIMIT 1",
            [activation_key]
        );
        if (!a) {
            return res.status(404).json({ success: false, message: "Invalid activation key." });
        }

        // Lock to the first machine that activates, so a key can't be reused
        // on another device. Re-running on the SAME machine (reinstall) is fine.
        if (a.activated_at && a.machine_id && machine_id && a.machine_id !== machine_id) {
            return res.status(409).json({
                success: false,
                message: "This activation key is already in use on another device."
            });
        }

        if (!a.activated_at) {
            await db.query(
                "UPDATE restaurant_activations SET activated_at = NOW(), machine_id = ? WHERE restaurant_id = ?",
                [machine_id || null, a.restaurant_id]
            );
        }

        const [[r]] = await db.query(
            "SELECT uuid, restaurant_name FROM restaurants WHERE id = ? LIMIT 1",
            [a.restaurant_id]
        );

        res.json({
            success: true,
            restaurant_uuid: r.uuid,
            restaurant_name: r.restaurant_name,
            sync_key: a.sync_key
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
