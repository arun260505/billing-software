const printerSettingModel = require("../models/printerSettingModel");
const directPrint = require("../utils/directPrint");
const { success, error } = require("../utils/response");

const TARGETS = ["cashier", "kitchen"];

/**
 * Which physical printer a receipt goes to, given the restaurant's setup.
 *
 *   dual_printer    the kitchen has its own printer, so KOTs go there
 *   cashier_kds     one printer; the kitchen reads a screen, so nothing routes there
 *   single_printer  one printer prints both the bill and the kitchen copy
 *
 * Anything that is not a kitchen ticket on a two-printer setup lands on the
 * cashier printer, which is also the only printer in the other two setups.
 */
function resolvePrinter(setting, target) {
    if (target === "kitchen" && setting.printer_mode === "dual_printer") {
        return { name: setting.kitchen_printer, label: "kitchen printer" };
    }
    return { name: setting.cashier_printer, label: "cashier printer" };
}

// POST /api/print   { text, target: "cashier" | "kitchen" }
exports.print = (req, res) => {
    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Restaurant context required.", 400);
    }

    const { text, target } = req.body || {};

    if (!TARGETS.includes(target)) {
        return error(res, `target must be one of: ${TARGETS.join(", ")}.`, 400);
    }
    if (typeof text !== "string" || !text.trim()) {
        return error(res, "Nothing to print.", 400);
    }

    // Answer before touching the database when this node cannot print at all, so
    // the cashier screen falls back to the browser dialog immediately.
    if (!directPrint.canPrint()) {
        return error(res, "This server cannot print directly — it is not the till PC.", 501);
    }

    printerSettingModel.getPrinterSetting(restaurantId, (err, data) => {
        if (err) return error(res, err.message, 500);

        const setting = data.setting || {};
        const { name, label } = resolvePrinter(setting, target);

        if (!name) {
            return error(
                res,
                `No ${label} is set. Choose one on the cashier's Printer page.`,
                409
            );
        }

        directPrint.printText(name, text, (printErr, result) => {
            if (printErr) {
                console.error("Direct print failed:", printErr.detail || printErr.message);
                return error(res, printErr.userMessage || "Could not print.", 502);
            }
            return success(res, `Printed to ${result.printer}.`, {
                printer: result.printer,
                target
            });
        });
    });
};
