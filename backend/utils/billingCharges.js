const db = require("../config/db");
const { applicableCharges } = require("./billing");

/*
|--------------------------------------------------------------------------
| The charge rows that go on a restaurant's bills
|--------------------------------------------------------------------------
| GST, the service charge and every other add-on (packing, delivery, AC) are
| rows in `charges`. The ones flagged auto_apply land on every bill of a
| matching order type; the rest are chips the cashier taps at settle time.
|
| This is the one place the biller asks what a restaurant charges. It replaced
| utils/taxRates.js, which read settings.tax_percentage / settings.service_charge
| and fell back to a hardcoded 5% + 2% — so a restaurant that is not registered
| for GST was billing GST anyway, with no screen anywhere able to switch it off.
| Now: no Tax charge row, no tax.
|
| Cached briefly: a single bill recompute can total several orders, and the
| charge list changes about as often as the menu does.
*/

const TTL_MS = 30 * 1000;
const cache = new Map();   // restaurantId -> { rows, at }

/**
 * getCharges(restaurantId, cb) -> cb(null, rows)
 *
 * Never calls back with an error: if the charges table can't be read we bill the
 * goods rather than failing the sale. A till mid-service must be able to take
 * money even when something is wrong with a config table.
 */
const getCharges = (restaurantId, callback) => {

    if (!restaurantId) return callback(null, []);

    const hit = cache.get(restaurantId);
    if (hit && Date.now() - hit.at < TTL_MS) {
        return callback(null, hit.rows.slice());
    }

    db.query(
        `SELECT id, charge_name, charge_type, charge_role, amount, auto_apply,
                applies_dinein, applies_takeaway, applies_delivery, status
         FROM charges
         WHERE restaurant_id = ? AND status = 'Active' AND deleted_at IS NULL`,
        [restaurantId],
        (err, rows) => {

            if (err) {
                console.error("billingCharges: billing goods only —", err.message);
                return callback(null, []);
            }

            const list = rows || [];
            cache.set(restaurantId, { rows: list, at: Date.now() });
            callback(null, list.slice());
        }
    );
};

/**
 * The charges that apply to a bill of this type with nobody choosing them —
 * GST, service charge, a standing packing fee. Everything a bill is charged
 * beyond the goods and the cashier's own selections.
 */
const getAutoCharges = (restaurantId, orderType, callback) => {
    getCharges(restaurantId, (err, rows) => {
        if (err) return callback(err);
        callback(null, applicableCharges(rows, orderType, true));
    });
};

// Called when a restaurant's charges are saved, so the next bill uses them
// immediately instead of waiting out the TTL.
const invalidate = (restaurantId) => {
    if (restaurantId) cache.delete(restaurantId);
    else cache.clear();
};

module.exports = { getCharges, getAutoCharges, invalidate };
