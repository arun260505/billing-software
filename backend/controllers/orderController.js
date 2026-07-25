const orderModel = require("../models/orderModel");
const generateOrderNumber = require("../utils/orderNumber");
// Get all orders
exports.getAllOrders = (req, res) => {

    orderModel.getAllOrders((err, results) => {

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

// Get order by ID
exports.getOrderById = (req, res) => {

    orderModel.getOrderById(req.params.id, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.json({
            success: true,
            data: results[0]
        });

    });

};

// Create order
exports.createOrder = (req, res) => {

    const restaurantId = req.body.restaurant_id;

    generateOrderNumber(restaurantId, (err, orderNumber) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        req.body.order_number = orderNumber;

        req.body.order_status =
            req.body.order_status || "Pending";

        req.body.payment_status =
            req.body.payment_status || "Pending";

        req.body.discount =
            req.body.discount || 0;

        req.body.tax =
            req.body.tax || 0;

        req.body.subtotal =
            req.body.subtotal || 0;

        req.body.grand_total =
            req.body.grand_total || 0;

        orderModel.createOrder(req.body, (err, result) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            res.status(201).json({
                success: true,
                message: "Order created successfully",
                order_id: result.insertId,
                order_number: orderNumber
            });

        });

    });

};

exports.createOrder = (req, res) => {

    const { items } = req.body;

    generateOrderNumber(req.body.restaurant_id, (err, orderNumber) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        req.body.order_number = orderNumber;
        req.body.order_status = req.body.order_status || "Pending";
        req.body.payment_status = req.body.payment_status || "Pending";

        orderModel.createOrder(req.body, (err, result) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            const orderId = result.insertId;
            orderModel.createOrderItems(items, orderId, (err) => {

    if (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }

    // If it's a Dine-In order, occupy the table
    if (req.body.order_type === "Dine-In" && req.body.table_id) {

        orderModel.updateTableStatus(
            req.body.table_id,
            "Occupied",
            (err) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                res.status(201).json({
                    success: true,
                    message: "Order created successfully",
                    order_id: orderId,
                    order_number: orderNumber
                });

            }
        );

    } else {

        res.status(201).json({
            success: true,
            message: "Order created successfully",
            order_id: orderId,
            order_number: orderNumber
        });

    }

});


        });

    });

};
// Delete order
exports.deleteOrder = (req, res) => {

    orderModel.deleteOrder(req.params.id, (err) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Order deleted successfully"
        });

    });

};