const kitchenModel = require("../models/kitchenModel");
const { success, error } = require("../utils/response");

// Get all kitchen orders
exports.getKitchenOrders = (req, res) => {

    kitchenModel.getKitchenOrders(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Kitchen orders fetched.", results);

    });

};

// Get kitchen order items
exports.getKitchenOrderItems = (req, res) => {

    kitchenModel.getKitchenOrderItems(req.params.id, req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Kitchen order items fetched.", results);

    });

};

// Update kitchen status
exports.updateKitchenStatus = (req, res) => {

    kitchenModel.updateKitchenStatus(
        req.params.id,
        req.user.restaurant_id,
        req.body.order_status,
        (err) => {

            if (err) return error(res, err.message, 500);

            return success(res, "Kitchen status updated successfully.");

        }
    );

};
