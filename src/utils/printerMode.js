/**
 * The restaurant's printer setup (Admin → Settings) and the two questions every
 * printing screen asks of it:
 *
 *   shouldPrintKotOnSend(mode, isCounter)  — print a KOT when the order is sent?
 *   shouldPrintKotWithBill(mode, isCounter) — print a KOT right after the bill?
 *
 * Keeping both answers here means the cashier and waiter screens can never drift
 * apart on what a mode is supposed to do.
 */

export const PRINTER_MODES = {
    CASHIER_KDS: "cashier_kds",
    DUAL_PRINTER: "dual_printer",
    SINGLE_PRINTER: "single_printer"
};

// Existing restaurants keep today's behaviour until an admin picks something else.
export const DEFAULT_PRINTER_MODE = PRINTER_MODES.DUAL_PRINTER;

export const PRINTER_MODE_OPTIONS = [
    {
        value: PRINTER_MODES.CASHIER_KDS,
        title: "Cashier printer + Kitchen Display",
        subtitle: "1 printer · kitchen reads a screen",
        description:
            "Only the cashier printer is connected. The kitchen works off the Kitchen Display screen, so no kitchen ticket is ever printed.",
        flow: ["Send to Kitchen → shows on the Kitchen Display", "Print & Settle → customer bill"]
    },
    {
        value: PRINTER_MODES.DUAL_PRINTER,
        title: "Cashier printer + Kitchen printer",
        subtitle: "2 printers · one each",
        description:
            "Two separate printers: the cashier printer prints customer bills, the kitchen printer prints the kitchen ticket as soon as an order is sent.",
        flow: ["Send to Kitchen → kitchen ticket (kitchen printer)", "Print & Settle → customer bill (cashier printer)"]
    },
    {
        value: PRINTER_MODES.SINGLE_PRINTER,
        title: "Single printer (bill + kitchen bill)",
        subtitle: "1 printer · 2 prints for counter orders",
        description:
            "One printer does everything. A counter/walk-in order prints two bills back to back — the customer bill, then the kitchen bill. Table orders print the customer bill only; the kitchen is told the order by hand.",
        flow: ["Counter order → customer bill, then kitchen bill", "Table order → customer bill only"]
    }
];

/**
 * Which printer devices the cashier has to connect, given the chosen setup.
 * The Printer page asks for exactly these and no more — two boxes for the
 * two-printer setup, one for the other two.
 */
const PRINTER_SLOTS = {
    [PRINTER_MODES.CASHIER_KDS]: [
        {
            key: "cashier_printer",
            label: "Cashier printer",
            role: "Customer bills",
            hint: "The kitchen reads the Kitchen Display, so there is no kitchen printer to connect."
        }
    ],
    [PRINTER_MODES.DUAL_PRINTER]: [
        {
            key: "cashier_printer",
            label: "Cashier printer",
            role: "Customer bills",
            hint: "The printer at the billing counter."
        },
        {
            key: "kitchen_printer",
            label: "Kitchen printer",
            role: "Kitchen tickets (KOT)",
            hint: "The printer in the kitchen. Tickets print here the moment an order is sent."
        }
    ],
    [PRINTER_MODES.SINGLE_PRINTER]: [
        {
            key: "cashier_printer",
            label: "Printer",
            role: "Customer bills + kitchen bills",
            hint: "One printer does both. A counter order prints the customer bill, then the kitchen bill."
        }
    ]
};

export function requiredPrinters(mode) {
    return PRINTER_SLOTS[normalizePrinterMode(mode)];
}

export const isValidPrinterMode = (mode) =>
    Object.values(PRINTER_MODES).includes(mode);

export const normalizePrinterMode = (mode) =>
    isValidPrinterMode(mode) ? mode : DEFAULT_PRINTER_MODE;

/**
 * Should a kitchen ticket print at the moment the order is sent to the kitchen?
 * Only the two-printer setup does this — it is the one with a printer sitting in
 * the kitchen waiting for it.
 */
export function shouldPrintKotOnSend(mode) {
    return normalizePrinterMode(mode) === PRINTER_MODES.DUAL_PRINTER;
}

/**
 * Should a kitchen ticket follow the customer bill out of the same printer?
 * Only the single-printer setup, and only for counter/walk-in orders — a table
 * order's kitchen copy is handled by hand there.
 */
export function shouldPrintKotWithBill(mode, isCounterOrder) {
    return (
        normalizePrinterMode(mode) === PRINTER_MODES.SINGLE_PRINTER &&
        Boolean(isCounterOrder)
    );
}

const printerMode = {
    PRINTER_MODES,
    DEFAULT_PRINTER_MODE,
    PRINTER_MODE_OPTIONS,
    requiredPrinters,
    isValidPrinterMode,
    normalizePrinterMode,
    shouldPrintKotOnSend,
    shouldPrintKotWithBill
};

export default printerMode;
