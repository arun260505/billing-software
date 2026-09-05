/**
 * The screen's copy of the billing arithmetic.
 *
 *   node --test tests/*.test.mjs      (npm run test:logic)
 *
 * src/utils/rates.js mirrors backend/utils/billing.js. The backend is the
 * authority — it recomputes every total it stores — but the cashier screen has
 * to predict it exactly, because a screen that disagrees with the database is
 * how a customer ends up paying one number while another is recorded.
 *
 * These are the same cases as backend/tests/billing.test.js. If one file's
 * expectations are edited without the other's, the two have drifted and one of
 * these suites should fail.
 *
 * The case that matters most: a restaurant with no charges configured is billed
 * no tax. GST used to be a hardcoded 5% (+ 2% service) on every bill, with no
 * screen anywhere able to switch it off.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
    ROLES,
    money,
    normalizeRole,
    applicableCharges,
    autoChargesFor,
    optionalChargesFor,
    resolveCharges,
    billTotals,
    billTotalsFromItems
} from "../src/utils/rates.js";

const gst = (pct) => ({
    charge_name: `GST ${pct}%`,
    charge_role: "Tax",
    charge_type: "Percentage",
    amount: pct
});

const service = (pct) => ({
    charge_name: `Service Charge ${pct}%`,
    charge_role: "Service",
    charge_type: "Percentage",
    amount: pct
});

test("money rounds to paise and kills float drift", () => {
    assert.equal(money(0.1 + 0.2), 0.3);
    assert.equal(money(10.005), 10.01);
    assert.equal(money("abc"), 0);
});

test("no charges configured means no tax and no service charge", () => {
    const t = billTotals(1000);
    assert.equal(t.tax, 0);
    assert.equal(t.service_charge, 0);
    assert.equal(t.charges_total, 0);
    assert.equal(t.grand_total, 1000);
});

test("a missing or junk charge list does not throw mid-sale", () => {
    assert.doesNotThrow(() => billTotals(100, null));
    assert.equal(billTotals(100, null).grand_total, 100);
    assert.equal(billTotals(100, "nonsense").grand_total, 100);
    assert.equal(billTotalsFromItems([], null).grand_total, 0);
});

test("only an explicit Tax/Service role leaves the ordinary charges bucket", () => {
    assert.equal(normalizeRole("tax"), ROLES.TAX);
    assert.equal(normalizeRole("Service"), ROLES.SERVICE);
    for (const junk of [undefined, null, "", "Charge", "taxes", "GST", 7]) {
        assert.equal(normalizeRole(junk), ROLES.CHARGE);
    }
});

test("charges land in the line their role names", () => {
    const t = billTotals(1000, [gst(5), service(2), { charge_name: "Packing", amount: 30 }]);
    assert.equal(t.tax, 50);
    assert.equal(t.service_charge, 20);
    assert.equal(t.charges_total, 30);
    assert.equal(t.grand_total, 1100);
});

test("tax is charged on the goods, never on the other charges", () => {
    const t = billTotals(1000, [gst(5), { charge_name: "Packing", amount: 500 }]);
    assert.equal(t.tax, 50);
});

test("several tax rows sum into one tax figure", () => {
    const t = billTotals(1000, [
        { charge_name: "CGST 2.5%", charge_role: "Tax", charge_type: "Percentage", amount: 2.5 },
        { charge_name: "SGST 2.5%", charge_role: "Tax", charge_type: "Percentage", amount: 2.5 }
    ]);
    assert.equal(t.tax, 50);
    assert.equal(t.tax_lines.length, 2);
});

test("grand_total is always the sum of the lines shown on screen", () => {
    const charges = [gst(18), service(10), { charge_name: "Packing", amount: 12.5 }];
    for (const sub of [0, 1, 99.99, 250.5, 787.35, 1337, 99999.95]) {
        const t = billTotals(sub, charges);
        assert.equal(
            t.grand_total,
            money(t.subtotal + t.tax + t.service_charge + t.charges_total),
            `grand_total disagreed with its parts at subtotal ${sub}`
        );
    }
});

test("the cart and the subtotal entry points agree", () => {
    const items = [{ price: 249.99, quantity: 3 }, { price: 10, quantity: 7 }];
    const charges = [gst(5), service(2)];
    assert.deepEqual(
        billTotalsFromItems(items, charges),
        billTotals(249.99 * 3 + 70, charges)
    );
});

test("a percentage charge is a percentage of the goods subtotal", () => {
    assert.deepEqual(
        resolveCharges([{ charge_name: "Delivery", charge_type: "Percentage", amount: 10 }], 1000),
        [{ charge_name: "Delivery", charge_role: ROLES.CHARGE, amount: 100 }]
    );
});

test("malformed charges never reach a bill", () => {
    assert.deepEqual(
        resolveCharges([
            { charge_name: "  ", amount: 10 },
            { charge_name: "Real", amount: 5 },
            { charge_name: "Bad", amount: "abc" },
            null
        ], 100),
        [{ charge_name: "Real", charge_role: ROLES.CHARGE, amount: 5 }]
    );
});

// ── Which charges reach which screen ────────────────────────────────────────

const ROWS = [
    { ...gst(5), id: 1, auto_apply: 1, status: "Active", applies_dinein: 1, applies_takeaway: 1, applies_delivery: 1 },
    { ...service(2), id: 2, auto_apply: 1, status: "Active", applies_dinein: 1, applies_takeaway: 0, applies_delivery: 0 },
    { id: 3, charge_name: "Packing", amount: 20, auto_apply: 0, status: "Active", applies_dinein: 0, applies_takeaway: 1, applies_delivery: 1 },
    { id: 4, charge_name: "Old AC Charge", amount: 40, auto_apply: 1, status: "Inactive", applies_dinein: 1, applies_takeaway: 1, applies_delivery: 1 }
];

test("an inactive charge never lands on a bill", () => {
    assert.ok(!applicableCharges(ROWS, "Dine-In").map((c) => c.id).includes(4));
});

test("order type decides which charges apply", () => {
    assert.deepEqual(applicableCharges(ROWS, "Dine-In").map((c) => c.id), [1, 2]);
    assert.deepEqual(applicableCharges(ROWS, "Takeaway").map((c) => c.id), [1, 3]);
});

test("service charge set to dine-in only stays off a takeaway bill", () => {
    const t = billTotals(1000, autoChargesFor(ROWS, "Takeaway"));
    assert.equal(t.tax, 50);
    assert.equal(t.service_charge, 0);
});

test("the cashier's chips are the opt-in charges, never the automatic ones", () => {
    // A GST chip the cashier could forget to tap would be a bill with no tax on
    // it, so tax and service must never appear in this list.
    assert.deepEqual(optionalChargesFor(ROWS, "Takeaway").map((c) => c.id), [3]);
    assert.deepEqual(optionalChargesFor(ROWS, "Dine-In").map((c) => c.id), []);
});

test("automatic and opt-in charges do not overlap", () => {
    for (const type of ["Dine-In", "Takeaway", "Delivery"]) {
        const auto = autoChargesFor(ROWS, type).map((c) => c.id);
        const optional = optionalChargesFor(ROWS, type).map((c) => c.id);
        assert.equal(
            auto.filter((id) => optional.includes(id)).length, 0,
            `a charge is both automatic and pickable on ${type} — it would bill twice`
        );
    }
});
