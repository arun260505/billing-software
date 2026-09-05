// Charges, and the one way to total a bill on screen.
//
// GST and the service charge are CHARGE ROWS (Admin → Charges), not settings.
// A row's charge_role decides which line of the bill it lands on:
//
//   'Tax'     -> the GST line          (orders.tax)
//   'Service' -> the service line      (orders.service_charge)
//   'Charge'  -> an itemised extra     (packing, delivery, AC …)
//
// auto_apply = 1 puts it on every bill of a matching order type; auto_apply = 0
// leaves it as a chip the cashier taps at settle time.
//
// This mirrors backend/utils/billing.js exactly: same filtering, same rounding,
// same order of operations. The backend is still the authority — it recomputes
// every total it stores — but the screen must predict it correctly, because a
// receipt that disagrees with the database is the bug this module exists to
// prevent.
//
// There is deliberately no default rate. GST used to be a hardcoded 5% (plus a
// 2% service charge) applied to every bill with no way to switch it off, which
// is wrong for every restaurant not registered for GST. No tax charge row now
// means no tax.

export const ROLES = { TAX: "Tax", SERVICE: "Service", CHARGE: "Charge" };

// Round to paise the way the backend does.
export const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Anything unrecognised is an ordinary charge — never silently a tax. */
export function normalizeRole(role) {
    const r = String(role || "").trim().toLowerCase();
    if (r === "tax") return ROLES.TAX;
    if (r === "service") return ROLES.SERVICE;
    return ROLES.CHARGE;
}

/** A charge row is usable only with a name and a numeric amount. */
export function isValidCharge(c) {
    return Boolean(c) &&
        String(c.charge_name || "").trim() !== "" &&
        Number.isFinite(Number(c.amount));
}

/**
 * Does this charge apply to an order of this type? Rows carrying none of the
 * applies_* flags (charges already stored on a settled order) always apply.
 */
export function appliesToOrderType(charge, orderType) {
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
}

const isActiveCharge = (c) => String(c.status || "Active") === "Active";

/**
 * The charges that belong on a bill: active, valid, matching the order type.
 * `onlyAuto` keeps just the ones applied without the cashier choosing them.
 */
export function applicableCharges(charges, orderType, onlyAuto = false) {
    return (Array.isArray(charges) ? charges : []).filter(
        (c) =>
            isValidCharge(c) &&
            isActiveCharge(c) &&
            appliesToOrderType(c, orderType) &&
            (!onlyAuto || Boolean(Number(c.auto_apply)))
    );
}

/** GST / service charge / standing fees — on the bill before anyone touches it. */
export function autoChargesFor(charges, orderType) {
    return applicableCharges(charges, orderType, true);
}

/** The opt-in charges the cashier can add — the chips on the bill screen. */
export function optionalChargesFor(charges, orderType) {
    return applicableCharges(charges, orderType).filter((c) => !Number(c.auto_apply));
}

/**
 * Resolve charge rows to rupee amounts against the goods subtotal.
 * Percentage charges are a percentage of the subtotal, not of the taxed total.
 */
export function resolveCharges(charges, subtotal) {
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
}

/** Bucket resolved charges into the three lines a bill shows. */
export function splitCharges(resolved) {
    const list = Array.isArray(resolved) ? resolved : [];
    const of = (role) => list.filter((c) => normalizeRole(c.charge_role) === role);
    const sum = (rows) => money(rows.reduce((s, c) => s + Number(c.amount || 0), 0));

    const tax_lines = of(ROLES.TAX);
    const service_lines = of(ROLES.SERVICE);
    const charge_lines = of(ROLES.CHARGE);

    return {
        tax: sum(tax_lines),
        service_charge: sum(service_lines),
        charges_total: sum(charge_lines),
        tax_lines,
        service_lines,
        charge_lines
    };
}

/**
 * Total a bill from its subtotal and the charge rows that apply to it.
 *
 * Each bucket is rounded to paise before being summed, because those are the
 * lines the customer reads on the receipt — the total has to be the sum of what
 * is printed.
 *
 * @param {number} subtotal
 * @param {Array}  charges  charge rows (unresolved) that apply to this bill
 * @returns {{subtotal, tax, service_charge, charges_total, grand_total,
 *            tax_lines, service_lines, charge_lines}}
 */
export function billTotals(subtotal, charges = []) {
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
}

/** Total from line items, for screens that hold a cart rather than a subtotal. */
export function billTotalsFromItems(items, charges = []) {
    return billTotals(
        (Array.isArray(items) ? items : [])
            .reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0),
        charges
    );
}
