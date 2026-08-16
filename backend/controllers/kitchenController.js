const kitchenModel = require("../models/kitchenModel");
const orderModel = require("../models/orderModel");
const { success, error } = require("../utils/response");

// Active items grouped by table (billed tables drop off / reset)
exports.getKitchenByTable = (req, res) => {

    kitchenModel.getKitchenByTable(req.user.restaurant_id, (err, tables) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Kitchen tables fetched.", tables);

    });

};

// Kitchen marks a single item served (strikes it through)
exports.serveItem = (req, res) => {

    orderModel.markItemServed(req.params.itemId, req.user.restaurant_id, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Item marked served.");

    });

};

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

// Get active tickets with their items (one call)
exports.getKitchenTickets = (req, res) => {

    kitchenModel.getKitchenTickets(req.user.restaurant_id, (err, tickets) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Kitchen tickets fetched.", tickets);

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
