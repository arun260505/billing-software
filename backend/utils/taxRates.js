const db = require("../config/db");
const { DEFAULT_GST_PERCENT, DEFAULT_SERVICE_PERCENT } = require("./billing");

/*
|--------------------------------------------------------------------------
| Per-restaurant GST / service-charge rates
|--------------------------------------------------------------------------
| settings.tax_percentage and settings.service_charge have been editable in
| Admin → Settings for a long time, but only Reports ever read them — the bill
| itself used a hardcoded 5% + 2%. So a restaurant could set 18% and see "18%"
| in its reports while every customer was charged 5%.
|
| This is the one place the biller asks what the rates are. Falls back to the
| historical 5/2 when a restaurant has never configured them (the settings row
| defaults both columns to 0), so no existing till changes what it charges
| until an admin actually edits Settings.
|
| Cached briefly: a single bill recompute can total several orders, and the
| rates change about once in a restaurant's lifetime.
*/

const TTL_MS = 30 * 1000;
const cache = new Map();   // restaurantId -> { rates, at }

const DEFAULTS = {
    gstPercent: DEFAULT_GST_PERCENT,
    servicePercent: DEFAULT_SERVICE_PERCENT
};

/**
 * getRates(restaurantId, cb) -> cb(null, { gstPercent, servicePercent })
 *
 * Never calls back with an error: if settings can't be read we bill at the
 * historical defaults rather than failing the sale. A till mid-service must be
 * able to take money even when something is wrong with the settings row.
 */
const getRates = (restaurantId, callback) => {

    if (!restaurantId) return callback(null, { ...DEFAULTS });

    const hit = cache.get(restaurantId);
    if (hit && Date.now() - hit.at < TTL_MS) {
        return callback(null, { ...hit.rates });
    }

    db.query(
        "SELECT tax_percentage, service_charge FROM settings WHERE restaurant_id = ? LIMIT 1",
        [restaurantId],
        (err, rows) => {

            if (err) {
                console.error("taxRates: falling back to defaults —", err.message);
                return callback(null, { ...DEFAULTS });
            }

            const row = rows && rows[0];
            const rates = {
                gstPercent: row ? row.tax_percentage : null,
                servicePercent: row ? row.service_charge : null
            };

            cache.set(restaurantId, { rates, at: Date.now() });
            callback(null, { ...rates });
        }
    );
};

// Called when a restaurant's settings are saved, so the next bill uses the new
// rates immediately instead of waiting out the TTL.
const invalidate = (restaurantId) => {
    if (restaurantId) cache.delete(restaurantId);
    else cache.clear();
};

module.exports = { getRates, invalidate, DEFAULTS };
