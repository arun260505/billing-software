const test = require("node:test");
const assert = require("node:assert");

const {
    GST_PERCENT,
    SERVICE_PERCENT,
    money,
    totalsFromSubtotal,
    totalsFromItems
} = require("../utils/billing");

/*
| utils/billing.js is the single place bill money is worked out. It exists
| because the same bill was once totalled three different ways and the customer
| paid one number while the database stored another. These tests are here to
| keep that from happening again quietly.
*/

test("money rounds to paise and kills float drift", () => {
    assert.strictEqual(money(0.1 + 0.2), 0.3);
    assert.strictEqual(money(10.005), 10.01);
    assert.strictEqual(money(10.004), 10);
    assert.strictEqual(money("42.5"), 42.5);
});

test("money treats junk as zero rather than NaN", () => {
    // A NaN reaching a bill would print "NaN" on a customer's receipt.
    assert.strictEqual(money(undefined), 0);
    assert.strictEqual(money(null), 0);
    assert.strictEqual(money("abc"), 0);
});

test("totalsFromSubtotal applies GST and service at the documented rates", () => {
    const t = totalsFromSubtotal(1000);
    assert.strictEqual(t.subtotal, 1000);
    assert.strictEqual(t.tax, (1000 * GST_PERCENT) / 100);
    assert.strictEqual(t.service_charge, (1000 * SERVICE_PERCENT) / 100);
    assert.strictEqual(t.grand_total, 1070);
});

test("grand_total is always subtotal + tax + service", () => {
    for (const sub of [0, 1, 99.99, 250.5, 1337, 99999.95]) {
        const t = totalsFromSubtotal(sub);
        assert.strictEqual(
            t.grand_total,
            money(t.subtotal + t.tax + t.service_charge),
            `grand_total disagreed with its parts at subtotal ${sub}`
        );
    }
});

test("an empty bill totals zero, not NaN", () => {
    const t = totalsFromItems([]);
    assert.deepStrictEqual(t, {
        subtotal: 0,
        tax: 0,
        service_charge: 0,
        grand_total: 0
    });
});

test("totalsFromItems multiplies price by quantity across lines", () => {
    const t = totalsFromItems([
        { price: 120, quantity: 2 },   // 240
        { price: 80.5, quantity: 1 },  //  80.50
        { price: 15, quantity: 4 }     //  60
    ]);
    assert.strictEqual(t.subtotal, 380.5);
    // Tax and service are each rounded to paise BEFORE being summed, so the
    // total is not money(subtotal * 1.07) — the components are the source of
    // truth, and they are what the receipt prints line by line.
    assert.strictEqual(t.grand_total, money(t.subtotal + t.tax + t.service_charge));
});

test("totalsFromItems agrees with totalsFromSubtotal on the same money", () => {
    // The two entry points must never drift apart — that drift is the exact
    // bug this module was created to end.
    const items = [{ price: 249.99, quantity: 3 }, { price: 10, quantity: 7 }];
    const sub = 249.99 * 3 + 70;
    assert.deepStrictEqual(totalsFromItems(items), totalsFromSubtotal(sub));
});
