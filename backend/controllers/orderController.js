const orderModel = require("../models/orderModel");
const generateOrderNumber = require("../utils/orderNumber");
const { success, error } = require("../utils/response");

// Get all orders
exports.getAllOrders = (req, res) => {

    orderModel.getAllOrders(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Orders fetched.", results);

    });

};

// Get order by ID
exports.getOrderById = (req, res) => {

    orderModel.getOrderById(req.params.id, req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        if (results.length === 0) return error(res, "Order not found.", 404);

        return success(res, "Order fetched.", results[0]);

    });

};

// Create order (+ items, + occupy table for Dine-In)
exports.createOrder = (req, res) => {

    const restaurantId = req.user.restaurant_id;   // tenant from JWT, never the body
    const { items } = req.body;

    generateOrderNumber(restaurantId, (err, orderNumber) => {

        if (err) return error(res, err.message, 500);

        const order = {
            ...req.body,
            restaurant_id: restaurantId,
            employee_id: req.user.id,               // the staff member who took the order
            order_number: orderNumber,
            order_status: req.body.order_status || "Pending",
            payment_status: req.body.payment_status || "Pending",
            subtotal: req.body.subtotal || 0,
            discount: req.body.discount || 0,
            tax: req.body.tax || 0,
            grand_total: req.body.grand_total || 0
        };

        orderModel.createOrder(order, (err, result) => {

            if (err) return error(res, err.message, 500);

            const orderId = result.insertId;

            orderModel.createOrderItems(items, orderId, (err) => {

                if (err) return error(res, err.message, 500);

                const respond = () => success(
                    res,
                    "Order created successfully.",
                    { order_id: orderId, order_number: orderNumber },
                    201
                );

                // Dine-In orders occupy the selected table.
                if (order.order_type === "Dine-In" && order.table_id) {

                    orderModel.updateTableStatus(
                        order.table_id,
                        restaurantId,
                        "Occupied",
                        (err) => {
                            if (err) return error(res, err.message, 500);
                            return respond();
                        }
                    );

                } else {
                    return respond();
                }

            });

        });

    });

};

// Delete order
exports.deleteOrder = (req, res) => {

    orderModel.deleteOrder(req.params.id, req.user.restaurant_id, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Order deleted successfully.");

    });

};
