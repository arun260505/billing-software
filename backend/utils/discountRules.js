const { money, resolveDiscount } = require("./billing");

/*
|--------------------------------------------------------------------------
| Front-desk discounts, on the owner's terms
|--------------------------------------------------------------------------
| The owner decides in Admin → Settings → Discounts whether the receptionist may
| take money off a bill, and how much: a maximum percentage, a maximum flat
| amount, or both (0 switches that kind off). The rule lives on `settings`, which
| syncs cloud → till, and is enforced here when a bill is created — the screen
| checks it too, but a screen is not a permission.
|
| Pure functions (no database) so they can be tested directly.
*/

/** The rule, read off a settings row. A missing row means discounts are off. */
const readPolicy = (row) => ({
    enabled: Boolean(Number(row && row.discount_enabled)),
    max_percent: money(row && row.discount_max_percent),
    max_amount: money(row && row.discount_max_amount),
    // Standing discount the owner applies to EVERY bill automatically.
    auto_type: ["percent", "amount"].includes(row && row.discount_auto_type) ? row.discount_auto_type : "none",
    auto_value: money(row && row.discount_auto_value)
});

// The rupee value of the owner's automatic (standing) discount on a subtotal.
const autoDiscountRupees = (policy, subtotal) => {
    const p = policy || {};
    const sub = money(subtotal);
    if (p.auto_type === "percent" && p.auto_value > 0) return resolveDiscount(sub, { percent: p.auto_value });
    if (p.auto_type === "amount" && p.auto_value > 0) return resolveDiscount(sub, { amount: p.auto_value });
    return 0;
};

/**
 * Check the discount asked for on a new bill.
 *
 * input:    { discount_type: "percent" | "amount", discount_value }
 *           (a bare numeric `discount` from an older client reads as an amount)
 * role:     the caller's role — the owner (admin) is capped only by the bill
 * subtotal: the bill's goods value, priced server-side
 *
 * Returns { discount, discount_percent } (rupees, and the rate for a % discount)
 * or { problem } with a message written for the person at the desk.
 */
const checkDiscount = ({ policy, role, input = {}, subtotal }) => {

    const sub = money(subtotal);

    let type = input.discount_type;
    let value = input.discount_value;
    if (!type && Number(input.discount) > 0) {
        type = "amount";
        value = input.discount;
    }

    const none = { discount: 0, discount_percent: null };
    if (!type || value === undefined || value === null || value === "") return none;

    const v = Number(value);
    if (!["percent", "amount"].includes(type) || !Number.isFinite(v) || v < 0) {
        return { problem: "Enter a valid discount." };
    }
    if (v === 0) return none;

    // The owner's automatic (standing) discount is always allowed, even when
    // manual desk discounts are off or below this — it's the owner's own rule.
    // A requested discount up to that standing amount passes without the limit
    // checks; anything above it still goes through the normal role/max checks.
    const requestedRupees = type === "percent" ? resolveDiscount(sub, { percent: v }) : resolveDiscount(sub, { amount: v });
    const standing = autoDiscountRupees(policy, sub);
    const withinStanding = standing > 0 && requestedRupees <= standing + 0.5;

    if (role !== "admin" && !withinStanding) {
        const p = policy || readPolicy(null);
        if (!p.enabled) {
            return { problem: "Discounts are turned off. The owner can allow them in Settings → Discounts." };
        }
        if (type === "percent") {
            if (!(p.max_percent > 0)) return { problem: "Percentage discounts aren't allowed." };
            if (v > p.max_percent) return { problem: `A discount can be at most ${p.max_percent}%.` };
        } else {
            if (!(p.max_amount > 0)) return { problem: "Flat-amount discounts aren't allowed." };
            if (v > p.max_amount) return { problem: `A discount can be at most ₹${p.max_amount}.` };
        }
    }

    if (type === "percent" && v > 100) return { problem: "A discount can't be more than 100%." };
    if (type === "amount" && v > sub) return { problem: "The discount can't be more than the bill." };

    return type === "percent"
        ? { discount: resolveDiscount(sub, { percent: v }), discount_percent: money(v) }
        : { discount: resolveDiscount(sub, { amount: v }), discount_percent: null };
};

module.exports = { readPolicy, checkDiscount, autoDiscountRupees };
