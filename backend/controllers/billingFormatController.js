const billingFormatModel = require("../models/billingFormatModel");
const { success, error } = require("../utils/response");

// GET /api/billing/format
exports.getFormat = (req, res) => {
    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Restaurant context required.", 400);
    }

    billingFormatModel.getBillFormat(restaurantId, (err, data) => {
        if (err) return error(res, err.message, 500);
        return success(res, "Billing format retrieved successfully.", data);
    });
};

// PUT /api/billing/format
exports.updateFormat = (req, res) => {
    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Restaurant context required.", 400);
    }

    // Support both { format, restaurant } payload and direct format object
    const formatData = req.body.format || req.body;
    const restaurantData = req.body.restaurant;

    billingFormatModel.saveBillFormat(restaurantId, formatData, (err) => {
        if (err) return error(res, err.message, 500);

        if (restaurantData && typeof restaurantData === "object") {
            billingFormatModel.updateRestaurantBranding(restaurantId, restaurantData, (restErr) => {
                if (restErr) return error(res, restErr.message, 500);

                billingFormatModel.getBillFormat(restaurantId, (fetchErr, data) => {
                    if (fetchErr) return error(res, fetchErr.message, 500);
                    return success(res, "Billing format and restaurant details saved successfully.", data);
                });
            });
        } else {
            billingFormatModel.getBillFormat(restaurantId, (fetchErr, data) => {
                if (fetchErr) return error(res, fetchErr.message, 500);
                return success(res, "Billing format saved successfully.", data);
            });
        }
    });
};

// PUT /api/billing/restaurant
exports.updateRestaurant = (req, res) => {
    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Restaurant context required.", 400);
    }

    billingFormatModel.updateRestaurantBranding(restaurantId, req.body, (err) => {
        if (err) return error(res, err.message, 500);

        billingFormatModel.getBillFormat(restaurantId, (fetchErr, data) => {
            if (fetchErr) return error(res, fetchErr.message, 500);
            return success(res, "Restaurant branding updated successfully.", data);
        });
    });
};
