const test = require("node:test");
const assert = require("node:assert");

// Pure helpers — no database involved, so these run in any environment.
const { formatOrderNumber, previewNextOrderNumber } = require("../utils/orderNumberFormat");

const TODAY = new Date().toISOString().split("T")[0];            // YYYY-MM-DD
const THIS_MONTH = TODAY.slice(0, 7);                            // YYYY-MM
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().split("T")[0];

// ── Formatting ──────────────────────────────────────────────────

test("formatOrderNumber pads the sequence to the configured width", () => {
    assert.strictEqual(formatOrderNumber({ prefix: "ORD", sequence: 1, digits: 4 }), "ORD-0001");
    assert.strictEqual(formatOrderNumber({ prefix: "ORD", sequence: 42, digits: 4 }), "ORD-0042");
    assert.strictEqual(formatOrderNumber({ prefix: "INV", sequence: 1, digits: 3 }), "INV-001");
    assert.strictEqual(formatOrderNumber({ prefix: "INV", sequence: 1, digits: 4 }), "INV-0001");
});

test("formatOrderNumber never truncates a number past its width", () => {
    assert.strictEqual(formatOrderNumber({ prefix: "ORD", sequence: 1000, digits: 3 }), "ORD-1000");
});

// ── "Never" reset ───────────────────────────────────────────────

test("Never: a fresh restaurant previews its starting number", () => {
    const row = { prefix: "ORD", starting_number: 1, digits: 4, reset_mode: "never" };
    assert.strictEqual(previewNextOrderNumber(row), "ORD-0001");
});

test("Never: continues incrementing after orders exist", () => {
    const row = { prefix: "ORD", starting_number: 1, digits: 4, reset_mode: "never", current_sequence: 5, sequence_reset_key: "" };
    assert.strictEqual(previewNextOrderNumber(row), "ORD-0006");
});

test("Never: a freshly saved format (NULL key) starts over from the starting number", () => {
    const row = { prefix: "INV", starting_number: 1, digits: 4, reset_mode: "never", current_sequence: 0, sequence_reset_key: null };
    assert.strictEqual(previewNextOrderNumber(row), "INV-0001");
});

// ── "Daily" reset ───────────────────────────────────────────────

test("Daily: continues inside the same day", () => {
    const row = { prefix: "ORD", starting_number: 1, digits: 4, reset_mode: "daily", current_sequence: 3, sequence_reset_key: TODAY };
    assert.strictEqual(previewNextOrderNumber(row), "ORD-0004");
});

test("Daily: restarts from the starting number on a new day", () => {
    const row = { prefix: "ORD", starting_number: 1, digits: 4, reset_mode: "daily", current_sequence: 3, sequence_reset_key: YESTERDAY };
    assert.strictEqual(previewNextOrderNumber(row), "ORD-0001");
});

test("Daily: a freshly saved format starts from the starting number", () => {
    const row = { prefix: "ORD", starting_number: 1, digits: 4, reset_mode: "daily", current_sequence: 0, sequence_reset_key: null };
    assert.strictEqual(previewNextOrderNumber(row), "ORD-0001");
});

// ── "Monthly" reset ─────────────────────────────────────────────

test("Monthly: continues inside the same month", () => {
    const row = { prefix: "ORD", starting_number: 1, digits: 3, reset_mode: "monthly", current_sequence: 9, sequence_reset_key: THIS_MONTH };
    assert.strictEqual(previewNextOrderNumber(row), "ORD-010");
});

test("Monthly: restarts from the starting number in a new month", () => {
    const row = { prefix: "ORD", starting_number: 1, digits: 4, reset_mode: "monthly", current_sequence: 12, sequence_reset_key: "2000-01" };
    assert.strictEqual(previewNextOrderNumber(row), "ORD-0001");
});

// ── Changing the format (admin) ─────────────────────────────────

test("Changing the prefix from ORD to INV starts a fresh INV sequence", () => {
    const row = { prefix: "INV", starting_number: 1, digits: 4, reset_mode: "never", current_sequence: 0, sequence_reset_key: null };
    assert.strictEqual(previewNextOrderNumber(row), "INV-0001");
});

test("A later starting number is respected", () => {
    const row = { prefix: "ORD", starting_number: 100, digits: 4, reset_mode: "never", current_sequence: 0, sequence_reset_key: null };
    assert.strictEqual(previewNextOrderNumber(row), "ORD-0100");
});