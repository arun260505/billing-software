const kitchenFormatModel = require("../models/kitchenFormatModel");
const { success, error } = require("../utils/response");

// GET /api/kitchen-format
exports.getFormat = (req, res) => {
    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Restaurant context required.", 400);
    }

    kitchenFormatModel.getKitchenFormat(restaurantId, (err, data) => {
        if (err) return error(res, err.message, 500);
        return success(res, "Kitchen format retrieved successfully.", data);
    });
};

// PUT /api/kitchen-format
exports.updateFormat = (req, res) => {
    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Restaurant context required.", 400);
    }

    const formatData = req.body.format || req.body;

    kitchenFormatModel.saveKitchenFormat(restaurantId, formatData, (err) => {
        if (err) return error(res, err.message, 500);

        kitchenFormatModel.getKitchenFormat(restaurantId, (fetchErr, data) => {
            if (fetchErr) return error(res, fetchErr.message, 500);
            return success(res, "Kitchen format saved successfully.", data);
        });
    });
};
