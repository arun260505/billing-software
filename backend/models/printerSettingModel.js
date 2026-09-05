const db = require("../config/db");

/*
| The three printer setups an admin can pick in Admin → Settings.
|
|   cashier_kds     Option 1 — one cashier printer + the Kitchen Display screen.
|                   No kitchen ticket is ever printed; the kitchen reads the display.
|   dual_printer    Option 2 — a cashier printer and a separate kitchen printer.
|                   The KOT prints the moment an order is sent to the kitchen.
|   single_printer  Option 3 — one printer for everything. A counter/walk-in order
|                   prints the customer bill followed by the kitchen bill; a table
|                   order prints the bill only (the kitchen is told by hand).
*/
const PRINTER_MODES = ["cashier_kds", "dual_printer", "single_printer"];

// Existing restaurants keep behaving exactly as they do today.
const DEFAULT_PRINTER_MODE = "dual_printer";

const DEFAULT_PRINTER_SETTING = {
    printer_mode: DEFAULT_PRINTER_MODE,
    // The devices the till prints to, recorded on the cashier's Printer page.
    // Which of them is actually used depends on the mode above.
    cashier_printer: null,
    kitchen_printer: null,
    // When 1, a waiter can print + settle a bill from the app; when 0 (default)
    // the waiter's bill goes to the cashier to print and settle.
    waiter_can_print_bill: 0
};

// Windows printer names are long but not unbounded; the column is VARCHAR(150).
const MAX_PRINTER_NAME = 150;

const cleanPrinterName = (value) => {
    if (value === undefined || value === null) return null;
    const name = String(value).trim();
    if (!name) return null;
    return name.slice(0, MAX_PRINTER_NAME);
};

const isValidMode = (mode) => PRINTER_MODES.includes(mode);

const getPrinterSetting = (restaurantId, callback) => {
    const sql = "SELECT * FROM printer_settings WHERE restaurant_id = ?";

    db.query(sql, [restaurantId], (err, results) => {
        if (err) return callback(err);

        const row = results && results.length > 0 ? results[0] : null;

        // A restaurant that has never saved a choice reads back the default,
        // so every caller can rely on `setting.printer_mode` being present.
        const setting = row
            ? { ...DEFAULT_PRINTER_SETTING, ...row }
            : { ...DEFAULT_PRINTER_SETTING, restaurant_id: restaurantId };

        callback(null, { setting });
    });
};

const savePrinterSetting = (restaurantId, data, callback) => {
    const sql = `
        INSERT INTO printer_settings (restaurant_id, printer_mode, waiter_can_print_bill)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
            printer_mode = VALUES(printer_mode),
            waiter_can_print_bill = VALUES(waiter_can_print_bill)
    `;

    const mode = isValidMode(data.printer_mode) ? data.printer_mode : DEFAULT_PRINTER_MODE;
    const waiterCanBill = (data.waiter_can_print_bill === true || Number(data.waiter_can_print_bill) === 1) ? 1 : 0;

    db.query(sql, [restaurantId, mode, waiterCanBill], callback);
};

/**
 * Save just the printer devices, leaving the mode alone. The cashier owns this
 * half of the row (the till is where the printers are plugged in); only an admin
 * may change the mode.
 */
const savePrinterDevices = (restaurantId, data, callback) => {
    const sql = `
        INSERT INTO printer_settings (restaurant_id, printer_mode, cashier_printer, kitchen_printer)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            cashier_printer = VALUES(cashier_printer),
            kitchen_printer = VALUES(kitchen_printer)
    `;

    // A restaurant that saves printers before an admin has picked a mode gets the
    // default mode written alongside; the ON DUPLICATE branch never touches it.
    const values = [
        restaurantId,
        DEFAULT_PRINTER_MODE,
        cleanPrinterName(data.cashier_printer),
        cleanPrinterName(data.kitchen_printer)
    ];

    db.query(sql, values, callback);
};

module.exports = {
    PRINTER_MODES,
    DEFAULT_PRINTER_MODE,
    DEFAULT_PRINTER_SETTING,
    MAX_PRINTER_NAME,
    isValidMode,
    cleanPrinterName,
    getPrinterSetting,
    savePrinterSetting,
    savePrinterDevices
};
