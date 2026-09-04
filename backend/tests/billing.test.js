const test = require("node:test");
const assert = require("node:assert");

const {
    GST_PERCENT,
    SERVICE_PERCENT,
    money,
    resolveRates,
    resolveCharges,
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
        charges_total: 0,
        grand_total: 0
    });
});

test("a null rates object does not throw mid-bill", () => {
    // `= {}` only defaults undefined. null arrives easily (a restaurant with no
    // settings row, a nullable value passed straight through), and throwing
    // here would fail the sale rather than bill at the default rates.
    assert.doesNotThrow(() => totalsFromSubtotal(100, null));
    assert.strictEqual(totalsFromSubtotal(100, null).tax, 5);
    assert.strictEqual(totalsFromItems([], null).grand_total, 0);
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

// ── Per-restaurant rates ────────────────────────────────────────────────────

test("a restaurant that never set its rates bills at the historical 5/2", () => {
    // The settings row defaults both columns to 0, so 0 must mean "unset" —
    // otherwise every existing till would silently start billing zero tax.
    for (const unset of [undefined, null, 0, "", "0", NaN, -1]) {
        assert.deepStrictEqual(
            resolveRates({ gstPercent: unset, servicePercent: unset }),
            { gstPercent: GST_PERCENT, servicePercent: SERVICE_PERCENT },
            `rate ${JSON.stringify(unset)} should fall back to the defaults`
        );
    }
    assert.deepStrictEqual(resolveRates(), {
        gstPercent: GST_PERCENT,
        servicePercent: SERVICE_PERCENT
    });
});

test("a configured rate is used instead of the default", () => {
    const t = totalsFromSubtotal(1000, { gstPercent: 18, servicePercent: 10 });
    assert.strictEqual(t.tax, 180);
    assert.strictEqual(t.service_charge, 100);
    assert.strictEqual(t.grand_total, 1280);
});

test("the two rates fall back independently", () => {
    // Setting GST alone must not silently reset the service charge, or vice versa.
    const t = totalsFromSubtotal(1000, { gstPercent: 12 });
    assert.strictEqual(t.tax, 120);
    assert.strictEqual(t.service_charge, 20);   // still the 2% default
});

// ── Per-bill charges ────────────────────────────────────────────────────────

test("a fixed charge adds its own amount", () => {
    const charges = resolveCharges([{ charge_name: "Packing", amount: 25 }], 1000);
    assert.deepStrictEqual(charges, [{ charge_name: "Packing", amount: 25 }]);
});

test("a percentage charge is a percentage of the goods subtotal", () => {
    // Not of the taxed total — the basis the cashier screen has always used.
    const charges = resolveCharges(
        [{ charge_name: "Delivery", charge_type: "Percentage", amount: 10 }],
        1000
    );
    assert.deepStrictEqual(charges, [{ charge_name: "Delivery", amount: 100 }]);
});

test("malformed charges never reach a bill", () => {
    // A blank name or a non-numeric amount used to print as a blank line.
    const charges = resolveCharges([
        { charge_name: "  ", amount: 10 },
        { charge_name: "Real", amount: 5 },
        { charge_name: "Bad", amount: "abc" },
        null,
        { amount: 12 }
    ], 100);
    assert.deepStrictEqual(charges, [{ charge_name: "Real", amount: 5 }]);
});

test("charges are added after tax and included in the grand total", () => {
    const charges = resolveCharges([{ charge_name: "Packing", amount: 30 }], 1000);
    const t = totalsFromSubtotal(1000, null, charges);

    assert.strictEqual(t.subtotal, 1000);
    assert.strictEqual(t.tax, 50);              // taxed on goods only
    assert.strictEqual(t.service_charge, 20);
    assert.strictEqual(t.charges_total, 30);
    assert.strictEqual(t.grand_total, 1100);
});

test("grand_total stays the sum of its parts once charges are involved", () => {
    const charges = resolveCharges(
        [{ charge_name: "Packing", amount: 12.5 },
         { charge_name: "Delivery", charge_type: "Percentage", amount: 3 }],
        787.35
    );
    const t = totalsFromSubtotal(787.35, { gstPercent: 18 }, charges);
    assert.strictEqual(
        t.grand_total,
        money(t.subtotal + t.tax + t.service_charge + t.charges_total)
    );
});

test("no charges means charges_total is 0, not undefined", () => {
    // orders.charges_total is NOT NULL, so undefined here would fail the insert.
    assert.strictEqual(totalsFromSubtotal(100).charges_total, 0);
    assert.strictEqual(totalsFromItems([]).charges_total, 0);
});
