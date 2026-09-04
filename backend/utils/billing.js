// The one place bill money is calculated.
//
// Before this existed the same bill was worked out three different ways — the
// backend charged per-item GST, the cashier receipt charged a flat 5% plus a 2%
// service charge, and the bill-edit paths charged 5% with no service charge. The
// customer paid one number and the database stored another. Everything that
// totals a bill now goes through here.
//
// Rates are per-restaurant (settings.tax_percentage / settings.service_charge),
// resolved by utils/taxRates.js and passed in. A restaurant that has never set
// them falls back to the constants below, which are what every bill used before
// the rates became configurable — so an existing till keeps billing exactly as
// it did until someone edits Settings.

const DEFAULT_GST_PERCENT = 5;
const DEFAULT_SERVICE_PERCENT = 2;

// Round to paise, avoiding the usual float drift (0.1 + 0.2 === 0.30000000000000004).
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

// A rate is "set" only if it is a positive number. The settings row defaults
// both columns to 0, so 0 means "never configured", not "bill zero tax".
const rateOr = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Normalise a rates object from whatever settings gave us.
 * @param {{gstPercent?: number, servicePercent?: number}} [rates]
 */
// `= {}` only covers undefined, and null reaches here easily — a settings row
// that doesn't exist, a caller passing through a nullable value. Normalise
// explicitly rather than throwing halfway through totalling a bill.
const resolveRates = (rates) => {
    const r = rates || {};
    return {
        gstPercent: rateOr(r.gstPercent, DEFAULT_GST_PERCENT),
        servicePercent: rateOr(r.servicePercent, DEFAULT_SERVICE_PERCENT)
    };
};

/**
 * Resolve per-bill charges (packing, delivery, AC …) to rupee amounts.
 * A "Percentage" charge is a percentage of the goods subtotal, not of the
 * taxed total — the same basis the cashier screen has always used.
 *
 * @param {Array<{charge_name: string, charge_type?: string, amount: number}>} charges
 * @param {number} subtotal
 * @returns {Array<{charge_name: string, amount: number}>}
 */
const resolveCharges = (charges = [], subtotal = 0) => {
    const sub = money(subtotal);
    return (Array.isArray(charges) ? charges : [])
        .filter((c) => c && String(c.charge_name || "").trim() && Number.isFinite(Number(c.amount)))
        .map((c) => ({
            charge_name: String(c.charge_name).trim(),
            amount: c.charge_type === "Percentage"
                ? money((sub * Number(c.amount)) / 100)
                : money(Number(c.amount))
        }));
};

/**
 * Total a bill from its subtotal.
 *
 * Tax and service are each rounded to paise BEFORE being summed, because those
 * are the numbers printed line by line on the receipt — the total has to be the
 * sum of what the customer can read, not a separately-rounded figure.
 *
 * @param {number} subtotal
 * @param {{gstPercent?: number, servicePercent?: number}} [rates]
 * @param {Array<{charge_name: string, amount: number}>} [resolvedCharges] already in rupees
 */
const totalsFromSubtotal = (subtotal, rates, resolvedCharges = []) => {

    const { gstPercent, servicePercent } = resolveRates(rates);

    const sub = money(subtotal);
    const tax = money((sub * gstPercent) / 100);
    const service = money((sub * servicePercent) / 100);
    const charges_total = money(
        (Array.isArray(resolvedCharges) ? resolvedCharges : [])
            .reduce((s, c) => s + Number(c.amount || 0), 0)
    );

    return {
        subtotal: sub,
        tax,
        service_charge: service,
        charges_total,
        grand_total: money(sub + tax + service + charges_total)
    };

};

/**
 * Total a bill from its line items.
 * @param {Array<{price: number, quantity: number}>} items
 * @param {{gstPercent?: number, servicePercent?: number}} [rates]
 * @param {Array<{charge_name: string, amount: number}>} [resolvedCharges]
 */
const totalsFromItems = (items = [], rates, resolvedCharges = []) =>
    totalsFromSubtotal(
        (Array.isArray(items) ? items : [])
            .reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0),
        rates,
        resolvedCharges
    );

module.exports = {
    DEFAULT_GST_PERCENT,
    DEFAULT_SERVICE_PERCENT,
    // Kept under the old names so nothing that imported the constants breaks.
    GST_PERCENT: DEFAULT_GST_PERCENT,
    SERVICE_PERCENT: DEFAULT_SERVICE_PERCENT,
    money,
    resolveRates,
    resolveCharges,
    totalsFromSubtotal,
    totalsFromItems
};
