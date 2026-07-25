const kitchenModel = require("../models/kitchenModel");

// Get all kitchen orders
exports.getKitchenOrders = (req, res) => {

    kitchenModel.getKitchenOrders((err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            data: results
        });

    });

};

// Get kitchen order items
exports.getKitchenOrderItems = (req, res) => {

    kitchenModel.getKitchenOrderItems(req.params.id, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            data: results
        });

    });

};

// Update kitchen status
exports.updateKitchenStatus = (req, res) => {

    kitchenModel.updateKitchenStatus(
        req.params.id,
        req.body.order_status,
        (err) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            res.json({
                success: true,
                message: "Kitchen status updated successfully"
            });

        }
    );

};