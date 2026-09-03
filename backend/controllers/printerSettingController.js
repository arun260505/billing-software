const printerSettingModel = require("../models/printerSettingModel");
const { success, error } = require("../utils/response");

// GET /api/printer-settings
exports.getSetting = (req, res) => {
    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Restaurant context required.", 400);
    }

    printerSettingModel.getPrinterSetting(restaurantId, (err, data) => {
        if (err) return error(res, err.message, 500);
        return success(res, "Printer settings retrieved successfully.", data);
    });
};

// PUT /api/printer-settings
exports.updateSetting = (req, res) => {
    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Restaurant context required.", 400);
    }

    const settingData = req.body.setting || req.body;

    if (!printerSettingModel.isValidMode(settingData.printer_mode)) {
        return error(
            res,
            `printer_mode must be one of: ${printerSettingModel.PRINTER_MODES.join(", ")}.`,
            400
        );
    }

    printerSettingModel.savePrinterSetting(restaurantId, settingData, (err) => {
        if (err) return error(res, err.message, 500);

        printerSettingModel.getPrinterSetting(restaurantId, (fetchErr, data) => {
            if (fetchErr) return error(res, fetchErr.message, 500);
            return success(res, "Printer settings saved successfully.", data);
        });
    });
};

// PUT /api/printer-settings/devices
// The cashier's Printer page — records which physical printers this till uses.
// Deliberately separate from updateSetting so a cashier can save the devices
// without being able to change the mode the admin picked.
exports.updateDevices = (req, res) => {
    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Restaurant context required.", 400);
    }

    const body = req.body.setting || req.body;

    printerSettingModel.savePrinterDevices(restaurantId, body, (err) => {
        if (err) return error(res, err.message, 500);

        printerSettingModel.getPrinterSetting(restaurantId, (fetchErr, data) => {
            if (fetchErr) return error(res, fetchErr.message, 500);
            return success(res, "Printers saved successfully.", data);
        });
    });
};
