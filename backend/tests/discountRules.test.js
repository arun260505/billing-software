const test = require("node:test");
const assert = require("node:assert");

const { readPolicy, checkDiscount } = require("../utils/discountRules");

/*
| The owner's front-desk discount rule (Settings → Discounts), enforced when a
| bill is created. The screen checks the same limits, but a screen is not a
| permission — these are the checks that actually stop a receptionist.
*/

const policy = (over = {}) => readPolicy({
    discount_enabled: 1,
    discount_max_percent: "10.00",
    discount_max_amount: "200.00",
    ...over
});

const desk = (input, p = policy(), subtotal = 1350) =>
    checkDiscount({ policy: p, role: "cashier", input, subtotal });

test("a missing settings row means discounts are off", () => {
    assert.deepStrictEqual(readPolicy(undefined), { enabled: false, max_percent: 0, max_amount: 0 });
});

test("no discount asked for is always fine, even with discounts off", () => {
    assert.deepStrictEqual(desk({}, readPolicy(null)), { discount: 0, discount_percent: null });
    assert.deepStrictEqual(desk({ discount_type: "percent", discount_value: "" }, readPolicy(null)), { discount: 0, discount_percent: null });
    assert.deepStrictEqual(desk({ discount_type: "amount", discount_value: 0 }, readPolicy(null)), { discount: 0, discount_percent: null });
});

test("the receptionist can't discount when the owner hasn't allowed it", () => {
    const r = desk({ discount_type: "percent", discount_value: 5 }, policy({ discount_enabled: 0 }));
    assert.match(r.problem, /turned off/);
});

test("a percentage within the limit is taken off the subtotal", () => {
    assert.deepStrictEqual(desk({ discount_type: "percent", discount_value: 10 }), { discount: 135, discount_percent: 10 });
});

test("a percentage over the limit is refused", () => {
    assert.match(desk({ discount_type: "percent", discount_value: 10.5 }).problem, /at most 10%/);
});

test("a flat amount within the limit is allowed", () => {
    assert.deepStrictEqual(desk({ discount_type: "amount", discount_value: "150" }), { discount: 150, discount_percent: null });
});

test("a flat amount over the limit is refused", () => {
    assert.match(desk({ discount_type: "amount", discount_value: 250 }).problem, /at most ₹200/);
});

test("a kind the owner set to 0 is not allowed at all", () => {
    assert.match(desk({ discount_type: "percent", discount_value: 1 }, policy({ discount_max_percent: 0 })).problem, /Percentage discounts aren't allowed/);
    assert.match(desk({ discount_type: "amount", discount_value: 1 }, policy({ discount_max_amount: 0 })).problem, /Flat-amount discounts aren't allowed/);
});

test("junk is refused rather than guessed at", () => {
    assert.match(desk({ discount_type: "percent", discount_value: "ten" }).problem, /valid discount/);
    assert.match(desk({ discount_type: "percent", discount_value: -5 }).problem, /valid discount/);
    assert.match(desk({ discount_type: "coupon", discount_value: 5 }).problem, /valid discount/);
});

test("a flat discount can't be more than the bill", () => {
    assert.match(desk({ discount_type: "amount", discount_value: 150 }, policy(), 100).problem, /more than the bill/);
});

test("the owner is capped only by the bill, not by the staff rule", () => {
    const off = readPolicy(null);
    assert.deepStrictEqual(
        checkDiscount({ policy: off, role: "admin", input: { discount_type: "percent", discount_value: 50 }, subtotal: 1000 }),
        { discount: 500, discount_percent: 50 }
    );
    assert.match(
        checkDiscount({ policy: off, role: "admin", input: { discount_type: "percent", discount_value: 120 }, subtotal: 1000 }).problem,
        /more than 100%/
    );
});

test("a bare numeric discount from an older client is checked as an amount", () => {
    assert.match(desk({ discount: 50 }, readPolicy(null)).problem, /turned off/);
    assert.deepStrictEqual(desk({ discount: 50 }), { discount: 50, discount_percent: null });
});
