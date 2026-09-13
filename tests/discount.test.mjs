/**
 * The screen's copy of the discount arithmetic (npm run test:logic).
 *
 * src/utils/rates.js must total a discounted bill exactly as
 * backend/utils/billing.js does — these are the same cases as the discount
 * section of backend/tests/billing.test.js.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { money, resolveDiscount, billTotals, billTotalsFromItems } from "../src/utils/rates.js";

const gst = (pct) => ({ charge_name: `GST ${pct}%`, charge_role: "Tax", charge_type: "Percentage", amount: pct });
const service = (pct) => ({ charge_name: `Service ${pct}%`, charge_role: "Service", charge_type: "Percentage", amount: pct });

test("no discount leaves every existing total unchanged", () => {
    const t = billTotals(1000, [gst(18)]);
    assert.equal(t.discount, 0);
    assert.equal(t.taxable, 1000);
    assert.equal(t.tax, 180);
    assert.equal(t.grand_total, 1180);
});

test("a discount comes off the goods before GST", () => {
    const t = billTotals(1000, [gst(18)], 100);
    assert.equal(t.subtotal, 1000);
    assert.equal(t.discount, 100);
    assert.equal(t.taxable, 900);
    assert.equal(t.tax, 162);
    assert.equal(t.grand_total, 1062);
});

test("percentage charges are worked on the discounted goods too", () => {
    const t = billTotals(1000, [{ charge_name: "Home visit", charge_type: "Percentage", amount: 10 }], 200);
    assert.equal(t.charges_total, 80);
    assert.equal(t.grand_total, 880);
});

test("a discount is never negative and never more than the bill", () => {
    assert.equal(billTotals(500, [gst(18)], -50).discount, 0);
    const all = billTotals(500, [gst(18)], 9999);
    assert.equal(all.discount, 500);
    assert.equal(all.tax, 0);
    assert.equal(all.grand_total, 0);
});

test("grand_total stays the sum of the printed lines with a discount", () => {
    const charges = [gst(18), service(5)];
    for (const [sub, disc] of [[787.35, 78.74], [1337, 133.7], [99.99, 10], [250.5, 0.01]]) {
        const t = billTotals(sub, charges, disc);
        assert.equal(t.grand_total, money(t.subtotal - t.discount + t.tax + t.service_charge + t.charges_total));
    }
});

test("resolveDiscount: percent of the subtotal, or a flat amount, clamped", () => {
    assert.equal(resolveDiscount(1350, { percent: 10 }), 135);
    assert.equal(resolveDiscount(1350, { percent: "12.5" }), 168.75);
    assert.equal(resolveDiscount(1350, { amount: 200 }), 200);
    assert.equal(resolveDiscount(1350, { percent: null, amount: "50" }), 50);
    assert.equal(resolveDiscount(100, { amount: 500 }), 100);
    assert.equal(resolveDiscount(100, { percent: 150 }), 100);
    assert.equal(resolveDiscount(100, {}), 0);
    assert.equal(resolveDiscount(100, { amount: "abc" }), 0);
});

test("the cart entry point passes the discount through", () => {
    const items = [{ price: 450, quantity: 1 }, { price: 900, quantity: 1 }];
    assert.deepEqual(billTotalsFromItems(items, [gst(18)], 135), billTotals(1350, [gst(18)], 135));
});
