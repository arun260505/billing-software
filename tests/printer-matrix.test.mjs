/**
 * The printer-setup matrix — the rules behind Admin → Settings.
 *
 *   node --test tests/*.test.mjs      (npm run test:logic)
 *
 * This is the part of test document 1 (section I, plus H01) that never got run:
 * it needs two physical printers and a shift's worth of switching modes back and
 * forth. The decisions themselves are pure functions, so the six mode × order-type
 * combinations are pinned here instead. What these tests CANNOT tell you is
 * whether paper comes out of the right machine — that still needs the hardware.
 *
 * Expected behaviour, from PROJECT_STATUS.md:
 *
 *   mode            | table order              | counter / walk-in order
 *   ----------------|--------------------------|-------------------------------
 *   cashier_kds     | bill only, no KOT        | bill only, no KOT
 *   dual_printer    | KOT on send, bill at settle | KOT on send, bill at settle
 *   single_printer  | bill only (kitchen told by hand) | customer bill, then kitchen bill
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
    PRINTER_MODES,
    DEFAULT_PRINTER_MODE,
    requiredPrinters,
    isValidPrinterMode,
    normalizePrinterMode,
    shouldPrintKotOnSend,
    shouldPrintKotWithBill
} from "../src/utils/printerMode.js";

const { CASHIER_KDS, DUAL_PRINTER, SINGLE_PRINTER } = PRINTER_MODES;

const TABLE = false;   // dine-in, a table is selected
const COUNTER = true;  // walk-in / parcel, no table

// One row per cell of the matrix above: [test id, mode, order type, KOT on send?,
// KOT behind the bill?]
const MATRIX = [
    ["AB-I01  dual · table",        DUAL_PRINTER,   TABLE,   true,  false],
    ["AB-I02  dual · counter",      DUAL_PRINTER,   COUNTER, true,  false],
    ["AB-I03  cashier+KDS · table", CASHIER_KDS,    TABLE,   false, false],
    ["AB-I04  cashier+KDS · counter", CASHIER_KDS,  COUNTER, false, false],
    ["AB-I05  single · table",      SINGLE_PRINTER, TABLE,   false, false],
    ["AB-I06  single · counter",    SINGLE_PRINTER, COUNTER, false, true]
];

for (const [name, mode, isCounter, onSend, withBill] of MATRIX) {
    test(name, () => {
        assert.equal(
            shouldPrintKotOnSend(mode, isCounter), onSend,
            `${mode}: kitchen ticket at send should be ${onSend}`
        );
        assert.equal(
            shouldPrintKotWithBill(mode, isCounter), withBill,
            `${mode}: kitchen copy behind the bill should be ${withBill}`
        );
    });
}

test("a kitchen ticket never prints twice for the same order", () => {
    // No mode may answer yes to both questions, or a counter order in that mode
    // would send the kitchen two copies of the same food.
    for (const mode of Object.values(PRINTER_MODES)) {
        for (const isCounter of [TABLE, COUNTER]) {
            assert.ok(
                !(shouldPrintKotOnSend(mode, isCounter) && shouldPrintKotWithBill(mode, isCounter)),
                `${mode} (counter=${isCounter}) would print the kitchen ticket twice`
            );
        }
    }
});

test("only the single-printer setup treats counter orders differently", () => {
    // The point of the matrix: in the other two setups a walk-in and a table
    // order print identically, so a cashier can't get a surprise.
    for (const mode of [CASHIER_KDS, DUAL_PRINTER]) {
        assert.equal(shouldPrintKotOnSend(mode, TABLE), shouldPrintKotOnSend(mode, COUNTER));
        assert.equal(shouldPrintKotWithBill(mode, TABLE), shouldPrintKotWithBill(mode, COUNTER));
    }
    assert.notEqual(
        shouldPrintKotWithBill(SINGLE_PRINTER, TABLE),
        shouldPrintKotWithBill(SINGLE_PRINTER, COUNTER)
    );
});

test("AB-H01  each setup asks for exactly the printers it uses", () => {
    // The cashier's Printer page renders one box per slot: two for the
    // two-printer setup, one for the other two.
    assert.equal(requiredPrinters(DUAL_PRINTER).length, 2);
    assert.equal(requiredPrinters(CASHIER_KDS).length, 1);
    assert.equal(requiredPrinters(SINGLE_PRINTER).length, 1);

    assert.deepEqual(
        requiredPrinters(DUAL_PRINTER).map((p) => p.key),
        ["cashier_printer", "kitchen_printer"]
    );
    // The single-printer and KDS setups must never ask for a kitchen printer —
    // there isn't one to connect.
    for (const mode of [CASHIER_KDS, SINGLE_PRINTER]) {
        assert.deepEqual(requiredPrinters(mode).map((p) => p.key), ["cashier_printer"]);
    }
    // Every slot needs a label and a role, or the page renders a blank box.
    for (const mode of Object.values(PRINTER_MODES)) {
        for (const slot of requiredPrinters(mode)) {
            assert.ok(slot.label && slot.role && slot.hint, `${mode}/${slot.key} is missing its copy`);
        }
    }
});

test("a restaurant that has never chosen a setup keeps the old behaviour", () => {
    // An existing restaurant has no printer_settings row, so the mode arrives as
    // null/undefined. It must land on dual_printer, which is what every install
    // did before the setting existed.
    assert.equal(DEFAULT_PRINTER_MODE, DUAL_PRINTER);
    for (const junk of [null, undefined, "", "DUAL_PRINTER", "kds", 0, false, {}, []]) {
        assert.equal(normalizePrinterMode(junk), DUAL_PRINTER);
    }
});

test("a corrupt mode cannot silently turn printing off", () => {
    // The dangerous failure is a bad value reading as "print nothing" — the
    // kitchen would just stop receiving tickets with no error anywhere.
    for (const junk of [null, undefined, "nonsense", 42]) {
        assert.equal(shouldPrintKotOnSend(junk), true, "a junk mode must still print the KOT");
        assert.equal(requiredPrinters(junk).length, 2);
    }
});

test("mode validation accepts exactly the three real setups", () => {
    for (const mode of Object.values(PRINTER_MODES)) {
        assert.ok(isValidPrinterMode(mode));
    }
    for (const junk of ["dual", "DUAL_PRINTER", "", null, undefined, 1]) {
        assert.ok(!isValidPrinterMode(junk));
    }
});
