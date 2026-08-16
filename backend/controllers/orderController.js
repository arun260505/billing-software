const orderModel = require("../models/orderModel");
const generateOrderNumber = require("../utils/orderNumber");
const { success, error } = require("../utils/response");

// Compute subtotal / tax / grand_total from a cart of items.
// Each item: { menu_item_id, quantity, price, gst }
const computeTotals = (items = []) => {
    let subtotal = 0;
    let tax = 0;
    items.forEach((it) => {
        const line = Number(it.price) * Number(it.quantity);
        subtotal += line;
        tax += (line * (Number(it.gst) || 0)) / 100;
    });
    return { subtotal, tax, grand_total: subtotal + tax };
};

// Normalise cart items into the order_items shape (adds `total`).
const toOrderItems = (items = []) =>
    items.map((it) => ({
        menu_item_id: it.menu_item_id,
        quantity: it.quantity,
        price: it.price,
        total: Number(it.price) * Number(it.quantity),
        notes: it.notes || null
    }));

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

    // Totals: use the ones sent, otherwise compute from the cart.
    const computed = computeTotals(items);
    const subtotal = req.body.subtotal != null ? Number(req.body.subtotal) : computed.subtotal;
    const tax = req.body.tax != null ? Number(req.body.tax) : computed.tax;
    const grand_total = req.body.grand_total != null ? Number(req.body.grand_total) : computed.grand_total;

    generateOrderNumber(restaurantId, (err, orderNumber) => {

        if (err) return error(res, err.message, 500);

        const order = {
            ...req.body,
            restaurant_id: restaurantId,
            employee_id: req.user.id,               // the logged-in waiter/cashier
            order_number: orderNumber,
            order_type: req.body.order_type || "Dine-In",
            // Orders auto-start as Preparing — the kitchen is display-only.
            order_status: req.body.order_status || "Preparing",
            payment_status: req.body.payment_status || "Pending",
            subtotal,
            discount: req.body.discount || 0,
            tax,
            grand_total
        };

        orderModel.createOrder(order, (err, result) => {

            if (err) return error(res, err.message, 500);

            const orderId = result.insertId;

            orderModel.createOrderItems(toOrderItems(items), orderId, (err) => {

                if (err) return error(res, err.message, 500);

                const respond = () => success(
                    res,
                    "Order created successfully.",
                    { order_id: orderId, order_number: orderNumber },
                    201
                );

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

// ============================ Waiter board ============================

// GET /api/orders/running
exports.getRunningOrders = (req, res) => {

    orderModel.getRunningOrders(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Running orders fetched.", results);

    });

};

// GET /api/orders/today-count
exports.getTodaysOrderCount = (req, res) => {

    orderModel.getTodaysOrderCount(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Today's order count fetched.", Number(results[0].total));

    });

};

// PUT /api/orders/:id/serve — waiter marks an order Served (off the kitchen board)
exports.markServed = (req, res) => {

    orderModel.markServed(req.params.id, req.user.restaurant_id, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Order marked as served.");

    });

};

// PUT /api/orders/item/:itemId/serve — mark one order-item served (waiter/cashier)
exports.markItemServed = (req, res) => {

    orderModel.markItemServed(req.params.itemId, req.user.restaurant_id, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Item marked as served.");

    });

};

// PUT /api/orders/item/:itemId/qty — set an item's quantity while editing the
// bill (no kitchen ticket created). Body: { quantity }.
exports.setItemQuantity = (req, res) => {

    orderModel.setItemQuantity(req.params.itemId, req.user.restaurant_id, req.body.quantity, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Quantity updated.", result);

    });

};

// POST /api/orders/table/:tableId/item — add an item to the bill (served but not
// recorded). Body: { menu_item_id, quantity }.
exports.addBillItem = (req, res) => {

    orderModel.addBillItem(
        req.params.tableId,
        req.user.restaurant_id,
        req.body.menu_item_id,
        req.body.quantity,
        req.user.id,
        (err, result) => {
            if (err) return error(res, err.message, 500);
            return success(res, "Item added to the bill.", result);
        }
    );

};

// DELETE /api/orders/item/:itemId — cancel one item from the bill (waiter edit)
exports.removeItem = (req, res) => {

    orderModel.removeOrderItem(req.params.itemId, req.user.restaurant_id, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Item cancelled.", result);

    });

};

// PUT /api/orders/table/:tableId/serve — mark all the table's orders served
exports.markTableServed = (req, res) => {

    orderModel.markTableServed(req.params.tableId, req.user.restaurant_id, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Table orders marked as served.");

    });

};

// POST /api/orders/table/:tableId/settle — complete the table's orders + free it
exports.settleTable = (req, res) => {

    orderModel.settleTable(req.params.tableId, req.user.restaurant_id, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Table settled and freed.");

    });

};

// GET /api/orders/table/:tableId/items — a table's active (unpaid) items, merged
exports.getTableActiveItems = (req, res) => {

    orderModel.getTableActiveItems(req.params.tableId, req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Table items fetched.", results);

    });

};

// GET /api/orders/:id/items
exports.getOrderDetails = (req, res) => {

    orderModel.getOrderDetails(req.params.id, req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Order items fetched.", results);

    });

};

// PUT /api/orders/:id  — replace the order's items and recompute totals
exports.updateOrder = (req, res) => {

    const restaurantId = req.user.restaurant_id;
    const orderId = req.params.id;
    const { items } = req.body;

    if (!items || items.length === 0) {
        return error(res, "Order must contain at least one item.", 400);
    }

    const totals = computeTotals(items);

    orderModel.updateOrderTotals(orderId, restaurantId, totals, (err) => {

        if (err) return error(res, err.message, 500);

        orderModel.deleteOrderItems(orderId, restaurantId, (err) => {

            if (err) return error(res, err.message, 500);

            orderModel.createOrderItems(toOrderItems(items), orderId, (err) => {

                if (err) return error(res, err.message, 500);

                return success(res, "Order updated successfully.");

            });

        });

    });

};

// DELETE /api/orders/:id  — soft cancel
exports.cancelOrder = (req, res) => {

    orderModel.cancelOrder(req.params.id, req.user.restaurant_id, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Order cancelled successfully.");

    });

};
