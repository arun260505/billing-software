const test = require("node:test");
const assert = require("node:assert");

const {
    ROLES,
    money,
    normalizeRole,
    applicableCharges,
    resolveCharges,
    splitCharges,
    totalsFromSubtotal,
    totalsFromItems
} = require("../utils/billing");

/*
| utils/billing.js is the single place bill money is worked out. It exists
| because the same bill was once totalled three different ways and the customer
| paid one number while the database stored another. These tests are here to
| keep that from happening again quietly.
|
| Since GST and the service charge became charge ROWS rather than hardcoded
| rates, the other thing these tests pin down is that a restaurant with no tax
| charge configured is billed no tax — for a long while every bill carried a
| forced 5% GST + 2% service that no screen could switch off.
*/

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

// ── No charges configured means no charges billed ───────────────────────────

test("a restaurant with no charges configured bills tax-free", () => {
    // The whole point of moving GST into Charges: a restaurant that is not
    // registered for GST must be able to bill without it. This used to be
    // impossible — 5% + 2% were applied with no way to switch them off.
    const t = totalsFromSubtotal(1000);
    assert.strictEqual(t.subtotal, 1000);
    assert.strictEqual(t.tax, 0);
    assert.strictEqual(t.service_charge, 0);
    assert.strictEqual(t.charges_total, 0);
    assert.strictEqual(t.grand_total, 1000);
});

test("null or junk in place of the charge list does not throw mid-bill", () => {
    // Throwing here would fail the sale rather than bill the goods.
    assert.doesNotThrow(() => totalsFromSubtotal(100, null));
    assert.strictEqual(totalsFromSubtotal(100, null).grand_total, 100);
    assert.strictEqual(totalsFromSubtotal(100, "nonsense").grand_total, 100);
    assert.strictEqual(totalsFromItems([], null).grand_total, 0);
});

test("an empty bill totals zero, not NaN", () => {
    const t = totalsFromItems([]);
    assert.strictEqual(t.subtotal, 0);
    assert.strictEqual(t.tax, 0);
    assert.strictEqual(t.service_charge, 0);
    assert.strictEqual(t.charges_total, 0);
    assert.strictEqual(t.grand_total, 0);
});

// ── Roles ───────────────────────────────────────────────────────────────────

test("only an explicit Tax/Service role leaves the ordinary charges bucket", () => {
    // A typo in charge_role must never silently become tax the restaurant is
    // then liable to remit.
    assert.strictEqual(normalizeRole("Tax"), ROLES.TAX);
    assert.strictEqual(normalizeRole("tax"), ROLES.TAX);
    assert.strictEqual(normalizeRole("Service"), ROLES.SERVICE);
    for (const junk of [undefined, null, "", "Charge", "taxes", "GST", 7]) {
        assert.strictEqual(normalizeRole(junk), ROLES.CHARGE);
    }
});

test("charges land in the column their role names", () => {
    const t = totalsFromSubtotal(1000, [
        gst(5),
        service(2),
        { charge_name: "Packing", amount: 30 }
    ]);

    assert.strictEqual(t.tax, 50);
    assert.strictEqual(t.service_charge, 20);
    assert.strictEqual(t.charges_total, 30);
    assert.strictEqual(t.grand_total, 1100);
});

test("several tax rows sum into one tax figure", () => {
    // CGST + SGST is the normal Indian split, and orders.tax must hold both.
    const t = totalsFromSubtotal(1000, [
        { charge_name: "CGST 2.5%", charge_role: "Tax", charge_type: "Percentage", amount: 2.5 },
        { charge_name: "SGST 2.5%", charge_role: "Tax", charge_type: "Percentage", amount: 2.5 }
    ]);
    assert.strictEqual(t.tax, 50);
    assert.strictEqual(t.tax_lines.length, 2);
    assert.strictEqual(t.grand_total, 1050);
});

test("a fixed-amount tax works as well as a percentage one", () => {
    const t = totalsFromSubtotal(1000, [
        { charge_name: "Cess", charge_role: "Tax", charge_type: "Fixed", amount: 15 }
    ]);
    assert.strictEqual(t.tax, 15);
});

// ── Arithmetic invariants ───────────────────────────────────────────────────

test("grand_total is always the sum of the parts printed on the receipt", () => {
    const charges = [gst(18), service(10), { charge_name: "Packing", amount: 12.5 }];
    for (const sub of [0, 1, 99.99, 250.5, 787.35, 1337, 99999.95]) {
        const t = totalsFromSubtotal(sub, charges);
        assert.strictEqual(
            t.grand_total,
            money(t.subtotal + t.tax + t.service_charge + t.charges_total),
            `grand_total disagreed with its parts at subtotal ${sub}`
        );
    }
});

test("totalsFromItems multiplies price by quantity across lines", () => {
    const t = totalsFromItems([
        { price: 120, quantity: 2 },   // 240
        { price: 80.5, quantity: 1 },  //  80.50
        { price: 15, quantity: 4 }     //  60
    ], [gst(5)]);
    assert.strictEqual(t.subtotal, 380.5);
    assert.strictEqual(t.grand_total, money(t.subtotal + t.tax));
});

test("totalsFromItems agrees with totalsFromSubtotal on the same money", () => {
    // The two entry points must never drift apart — that drift is the exact
    // bug this module was created to end.
    const items = [{ price: 249.99, quantity: 3 }, { price: 10, quantity: 7 }];
    const sub = 249.99 * 3 + 70;
    const charges = [gst(5), service(2)];
    assert.deepStrictEqual(totalsFromItems(items, charges), totalsFromSubtotal(sub, charges));
});

// ── Resolving individual charge rows ────────────────────────────────────────

test("a fixed charge adds its own amount", () => {
    assert.deepStrictEqual(
        resolveCharges([{ charge_name: "Packing", amount: 25 }], 1000),
        [{ charge_name: "Packing", charge_role: ROLES.CHARGE, amount: 25 }]
    );
});

test("a percentage charge is a percentage of the goods subtotal", () => {
    // Not of the taxed total — the basis the cashier screen has always used.
    assert.deepStrictEqual(
        resolveCharges([{ charge_name: "Delivery", charge_type: "Percentage", amount: 10 }], 1000),
        [{ charge_name: "Delivery", charge_role: ROLES.CHARGE, amount: 100 }]
    );
});

test("tax is charged on the goods, never on the other charges", () => {
    // Packing must not inflate the GST line, or the restaurant remits tax it
    // never collected.
    const t = totalsFromSubtotal(1000, [gst(5), { charge_name: "Packing", amount: 500 }]);
    assert.strictEqual(t.tax, 50);
});

test("malformed charges never reach a bill", () => {
    // A blank name or a non-numeric amount used to print as a blank line.
    assert.deepStrictEqual(
        resolveCharges([
            { charge_name: "  ", amount: 10 },
            { charge_name: "Real", amount: 5 },
            { charge_name: "Bad", amount: "abc" },
            null,
            { amount: 12 }
        ], 100),
        [{ charge_name: "Real", charge_role: ROLES.CHARGE, amount: 5 }]
    );
});

test("splitCharges buckets an already-resolved list without re-resolving it", () => {
    // order_charges rows come back from the DB already in rupees.
    const split = splitCharges([
        { charge_name: "GST 5%", charge_role: "Tax", amount: 50 },
        { charge_name: "Packing", charge_role: "Charge", amount: 30 }
    ]);
    assert.strictEqual(split.tax, 50);
    assert.strictEqual(split.charges_total, 30);
    assert.strictEqual(split.service_charge, 0);
});

// ── Which charges apply to which bill ───────────────────────────────────────

const ROWS = [
    { ...gst(5), id: 1, auto_apply: 1, status: "Active", applies_dinein: 1, applies_takeaway: 1, applies_delivery: 1 },
    { ...service(2), id: 2, auto_apply: 1, status: "Active", applies_dinein: 1, applies_takeaway: 0, applies_delivery: 0 },
    { id: 3, charge_name: "Packing", amount: 20, auto_apply: 0, status: "Active", applies_dinein: 0, applies_takeaway: 1, applies_delivery: 1 },
    { id: 4, charge_name: "Old AC Charge", amount: 40, auto_apply: 1, status: "Inactive", applies_dinein: 1, applies_takeaway: 1, applies_delivery: 1 }
];

test("an inactive charge never lands on a bill", () => {
    // Switching a charge off in Admin is how a restaurant stops billing it, so
    // this is the one that must not regress.
    const ids = applicableCharges(ROWS, "Dine-In").map((c) => c.id);
    assert.ok(!ids.includes(4));
});

test("order type decides which charges apply", () => {
    assert.deepStrictEqual(applicableCharges(ROWS, "Dine-In").map((c) => c.id), [1, 2]);
    assert.deepStrictEqual(applicableCharges(ROWS, "Takeaway").map((c) => c.id), [1, 3]);
    assert.deepStrictEqual(applicableCharges(ROWS, "Delivery").map((c) => c.id), [1, 3]);
});

test("service charge set to dine-in only stays off a takeaway bill", () => {
    const t = totalsFromSubtotal(1000, applicableCharges(ROWS, "Takeaway", true));
    assert.strictEqual(t.tax, 50);
    assert.strictEqual(t.service_charge, 0);
});

test("only auto-apply charges are billed without the cashier picking them", () => {
    // Packing is opt-in: it must not appear on a takeaway bill on its own.
    assert.deepStrictEqual(
        applicableCharges(ROWS, "Takeaway", true).map((c) => c.id),
        [1]
    );
});

test("stored order_charges rows carry no applies_* flags and always apply", () => {
    // They were decided at settle time; re-filtering them by order type would
    // silently drop charges off a reprinted bill.
    const stored = [{ charge_name: "Packing", amount: 20 }];
    assert.strictEqual(applicableCharges(stored, "Dine-In").length, 1);
});

test("no charges means charges_total is 0, not undefined", () => {
    // orders.charges_total is NOT NULL, so undefined here would fail the insert.
    assert.strictEqual(totalsFromSubtotal(100).charges_total, 0);
    assert.strictEqual(totalsFromItems([]).charges_total, 0);
});
