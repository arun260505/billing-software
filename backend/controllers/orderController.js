const Order = require("../models/Order");

exports.createOrder = (req, res) => {

    const {
    order_number,
    waiter_id,
    table_id,
    items,
} = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Order items are required"
        });
    }

    let totalItems = 0;
    let subtotal = 0;
    let gstAmount = 0;

    items.forEach(item => {
        totalItems += item.quantity;
        subtotal += item.price * item.quantity;
        gstAmount += ((item.price * item.quantity) * item.gst) / 100;
    });

    const grandTotal = subtotal + gstAmount;

    const orderData = {
    order_number,
    waiter_id,
    table_id,
    total_items: totalItems,
    subtotal,
    gst_amount: gstAmount,
    grand_total: grandTotal
};

    Order.createOrder(orderData, (err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        const orderId = result.insertId;

        let completed = 0;

        items.forEach(item => {

            Order.addOrderItem({
                order_id: orderId,
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity
            }, (err) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                completed++;

                if (completed === items.length) {
                    res.status(201).json({
                        success: true,
                        message: "Order created successfully",
                        order_id: orderId
                    });
                }

            });

        });

    });

};

exports.getOrders = (req, res) => {

    Order.getOrders((err, results) => {

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

exports.getOrderById = (req, res) => {

    const id = req.params.id;

    Order.getOrderById(id, (err, results) => {

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

exports.getRunningOrders = (req, res) => {

    Order.getRunningOrders((err, results) => {

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

exports.getOrderDetails = (req, res) => {

    const id = req.params.id;

    Order.getOrderDetails(id, (err, results) => {

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

exports.updateOrder = (req, res) => {

    const orderId = req.params.id;
    const { items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Order must contain at least one item."
        });
    }

    let totalItems = 0;
    let subtotal = 0;
    let gstAmount = 0;

    items.forEach(item => {
        totalItems += item.quantity;
        subtotal += item.price * item.quantity;
        const gst = item.gst || 5;

gstAmount += (item.price * item.quantity * gst) / 100;
    });

    const grandTotal = subtotal + gstAmount;

    const orderData = {
        order_id: orderId,
        total_items: totalItems,
        subtotal,
        gst_amount: gstAmount,
        grand_total: grandTotal
    };

    Order.updateOrder(orderData, (err) => {

        if (err) {
            return res.status(500).json({
                success: false,
                error: err
            });
        }

        Order.deleteOrderItems(orderId, (err) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    error: err
                });
            }

            let completed = 0;

            items.forEach(item => {

                const orderItem = {
                    order_id: orderId,
                    menu_item_id: item.menu_item_id,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.price * item.quantity
                };

                Order.addUpdatedOrderItem(orderItem, (err) => {

                    if (err) {
                        return res.status(500).json({
                            success: false,
                            error: err
                        });
                    }

                    completed++;

                    if (completed === items.length) {

                        res.json({
                            success: true,
                            message: "Order updated successfully."
                        });

                    }

                });

            });

        });

    });

};

exports.cancelOrder = (req, res) => {

    const orderId = req.params.id;

    Order.cancelOrder(orderId, (err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.json({
            success: true,
            message: "Order cancelled successfully."
        });

    });

};