// The one place bill money is calculated.
//
// Before this existed the same bill was worked out three different ways — the
// backend charged per-item GST, the cashier receipt charged a flat 5% plus a 2%
// service charge, and the bill-edit paths charged 5% with no service charge. The
// customer paid one number and the database stored another. Everything that
// totals a bill now goes through here.
//
// GST and the service charge are CHARGE ROWS, not settings. Every line added on
// top of the goods — tax, service, packing, delivery — is a row in `charges`
// with a role:
//
//   charge_role = 'Tax'      -> totalled into orders.tax
//   charge_role = 'Service'  -> totalled into orders.service_charge
//   charge_role = 'Charge'   -> itemised in order_charges, summed into charges_total
//
// A row with auto_apply = 1 lands on every bill of a matching order type; the
// rest stay opt-in chips the cashier taps at settle time. The roles exist only
// so the tax a restaurant collects is still separable for GST reporting — the
// arithmetic is identical for all three.
//
// There is deliberately NO hardcoded fallback rate. A restaurant with no Tax
// charge configured bills no tax, because plenty of them are not registered for
// GST at all. (Historically this file forced 5% GST + 2% service on every bill
// with no way to switch it off.)

const ROLES = { TAX: "Tax", SERVICE: "Service", CHARGE: "Charge" };

// Round to paise, avoiding the usual float drift (0.1 + 0.2 === 0.30000000000000004).
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Anything unrecognised is an ordinary charge — never silently a tax. */
const normalizeRole = (role) => {
    const r = String(role || "").trim().toLowerCase();
    if (r === "tax") return ROLES.TAX;
    if (r === "service") return ROLES.SERVICE;
    return ROLES.CHARGE;
};

/** A charge row is usable only with a name and a numeric amount. */
const isValidCharge = (c) =>
    Boolean(c) &&
    String(c.charge_name || "").trim() !== "" &&
    Number.isFinite(Number(c.amount));

/**
 * Does this charge apply to an order of this type?
 * Rows carrying none of the applies_* flags (the stored order_charges rows, which
 * were already decided at settle time) always apply.
 */
const appliesToOrderType = (charge, orderType) => {
    const hasFlags =
        "applies_dinein" in charge ||
        "applies_takeaway" in charge ||
        "applies_delivery" in charge;
    if (!hasFlags) return true;

    const t = String(orderType || "Dine-In").toLowerCase();
    if (t === "takeaway" || t === "parcel" || t === "take away") {
        return Boolean(Number(charge.applies_takeaway));
    }
    if (t === "delivery") return Boolean(Number(charge.applies_delivery));
    return Boolean(Number(charge.applies_dinein));
};

/** Active unless it says otherwise — order_charges rows carry no status. */
const isActiveCharge = (c) => String(c.status || "Active") === "Active";

/**
 * The charges that belong on a bill: active, valid, matching the order type.
 * `onlyAuto` keeps just the ones that apply without the cashier picking them.
 */
const applicableCharges = (charges, orderType, onlyAuto = false) =>
    (Array.isArray(charges) ? charges : []).filter(
        (c) =>
            isValidCharge(c) &&
            isActiveCharge(c) &&
            appliesToOrderType(c, orderType) &&
            (!onlyAuto || Boolean(Number(c.auto_apply)))
    );

/**
 * Resolve charge rows to rupee amounts against the goods subtotal.
 * A "Percentage" charge is a percentage of the goods subtotal, not of the taxed
 * total — the same basis the cashier screen has always used.
 *
 * @param {Array<{charge_name: string, charge_type?: string, charge_role?: string, amount: number}>} charges
 * @param {number} subtotal
 * @returns {Array<{charge_name: string, charge_role: string, amount: number}>}
 */
const resolveCharges = (charges = [], subtotal = 0) => {
    const sub = money(subtotal);
    return (Array.isArray(charges) ? charges : [])
        .filter(isValidCharge)
        .map((c) => ({
            charge_name: String(c.charge_name).trim(),
            charge_role: normalizeRole(c.charge_role),
            amount: c.charge_type === "Percentage"
                ? money((sub * Number(c.amount)) / 100)
                : money(Number(c.amount))
        }));
};

/**
 * Bucket resolved charges into the three columns a bill stores.
 * @param {Array<{charge_name, charge_role, amount}>} resolved
 */
const splitCharges = (resolved = []) => {
    const list = Array.isArray(resolved) ? resolved : [];
    const of = (role) => list.filter((c) => normalizeRole(c.charge_role) === role);
    const sum = (rows) => money(rows.reduce((s, c) => s + Number(c.amount || 0), 0));

    const taxLines = of(ROLES.TAX);
    const serviceLines = of(ROLES.SERVICE);
    const chargeLines = of(ROLES.CHARGE);

    return {
        tax: sum(taxLines),
        service_charge: sum(serviceLines),
        charges_total: sum(chargeLines),
        tax_lines: taxLines,
        service_lines: serviceLines,
        charge_lines: chargeLines
    };
};

/**
 * Total a bill from its subtotal and the charge rows that apply to it.
 *
 * Each bucket is rounded to paise BEFORE being summed, because those are the
 * numbers printed line by line on the receipt — the total has to be the sum of
 * what the customer can read, not a separately-rounded figure.
 *
 * @param {number} subtotal
 * @param {Array} charges  charge rows (unresolved) that apply to this bill
 */
const totalsFromSubtotal = (subtotal, charges = []) => {

    const sub = money(subtotal);
    const split = splitCharges(resolveCharges(charges, sub));

    return {
        subtotal: sub,
        tax: split.tax,
        service_charge: split.service_charge,
        charges_total: split.charges_total,
        grand_total: money(sub + split.tax + split.service_charge + split.charges_total),
        tax_lines: split.tax_lines,
        service_lines: split.service_lines,
        charge_lines: split.charge_lines
    };

};

/**
 * Total a bill from its line items.
 * @param {Array<{price: number, quantity: number}>} items
 * @param {Array} charges
 */
const totalsFromItems = (items = [], charges = []) =>
    totalsFromSubtotal(
        (Array.isArray(items) ? items : [])
            .reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0),
        charges
    );

module.exports = {
    ROLES,
    money,
    normalizeRole,
    isValidCharge,
    appliesToOrderType,
    applicableCharges,
    resolveCharges,
    splitCharges,
    totalsFromSubtotal,
    totalsFromItems
};
