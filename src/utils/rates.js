// GST and service-charge rates, and the one way to total a bill on screen.
//
// These numbers were hardcoded in eight places — the cashier screen alone had
// `subtotal * 0.05` three times — and the waiter's bill modal used
// Math.round(subtotal * 0.05), rounding tax to whole rupees while charging no
// service at all. So the same table could be quoted three different totals
// depending on which screen the customer was shown.
//
// This mirrors backend/utils/billing.js exactly: same fallbacks, same
// rounding, same order of operations. The backend is still the authority — it
// recomputes every total it stores — but the screen must predict it correctly,
// because a receipt that disagrees with the database is the bug this whole
// module exists to prevent.

export const DEFAULT_GST_PERCENT = 5;
export const DEFAULT_SERVICE_PERCENT = 2;

// Round to paise the way the backend does.
export const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

// A rate counts as configured only when it is positive: the settings row
// defaults both columns to 0, so 0 means "never set", not "charge nothing".
const rateOr = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Pull the rates out of a restaurant/settings object from the API.
 * Accepts whatever shape the caller has — settings, restaurantInfo — and falls
 * back to the historical 5% / 2% when the restaurant has not set them.
 */
export function ratesFrom(settings) {
    // settings is routinely null here — restaurantInfo starts null and is filled
    // in by a fetch, so every screen renders at least once before it arrives.
    const s = settings || {};
    return {
        gstPercent: rateOr(s.tax_percentage, DEFAULT_GST_PERCENT),
        servicePercent: rateOr(s.service_charge, DEFAULT_SERVICE_PERCENT)
    };
}

/**
 * Resolve per-bill charges to rupee amounts against the goods subtotal.
 * Percentage charges are a percentage of the subtotal, not of the taxed total.
 */
export function resolveCharges(charges, subtotal) {
    const sub = money(subtotal);
    return (Array.isArray(charges) ? charges : [])
        .filter((c) => c && String(c.charge_name || "").trim() && Number.isFinite(Number(c.amount)))
        .map((c) => ({
            charge_name: String(c.charge_name).trim(),
            amount: c.charge_type === "Percentage"
                ? money((sub * Number(c.amount)) / 100)
                : money(Number(c.amount))
        }));
}

/**
 * Total a bill. `resolvedCharges` must already be in rupees (resolveCharges).
 *
 * Tax and service are each rounded to paise before being summed, because those
 * are the lines the customer reads on the receipt — the total has to be the sum
 * of what is printed.
 *
 * @returns {{subtotal, tax, service_charge, charges_total, grand_total}}
 */
export function billTotals(subtotal, settings, resolvedCharges = []) {
    const { gstPercent, servicePercent } = ratesFrom(settings);

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
}

/** Total from line items, for screens that hold a cart rather than a subtotal. */
export function billTotalsFromItems(items, settings, resolvedCharges = []) {
    return billTotals(
        (Array.isArray(items) ? items : [])
            .reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0),
        settings,
        resolvedCharges
    );
}
