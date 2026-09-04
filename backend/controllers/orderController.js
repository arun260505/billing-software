const orderModel = require("../models/orderModel");
const generateOrderNumber = require("../utils/orderNumber");
const auditLog = require("../utils/auditLog");
const { totalsFromItems } = require("../utils/billing");
const { getRates } = require("../utils/taxRates");
const { success, error } = require("../utils/response");

// Totals come from utils/billing so a bill adds up the same way whether it is
// being created, edited or reprinted. Client-sent totals are ignored — the
// receipt and the database have to agree, and only one of them can be right.
// Rates are the restaurant's own (Admin → Settings), falling back to the
// historical 5% / 2% when it has never set them.
const computeTotals = totalsFromItems;

// Cart items are normalised (and priced from menu_items) by
// orderModel.priceCartItems — the client's own price is never used.

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

    // Price the cart from menu_items before totalling anything. The client's
    // price field is ignored: the receipt and the database have to agree, and
    // a cart posted by a phone is not a source of truth about money.
    orderModel.priceCartItems(items, restaurantId, (err, pricedItems) => {

        if (err) return error(res, err.message, 400);

        getRates(restaurantId, (err, rates) => {

        if (err) return error(res, err.message, 500);

        const { subtotal, tax, service_charge, grand_total } = computeTotals(pricedItems, rates);

        generateOrderNumber(restaurantId, (err, orderNumber) => {

            if (err) return error(res, err.message, 500);

            const order = {
                ...req.body,
                restaurant_id: restaurantId,
                employee_id: req.user.id,           // the logged-in waiter/cashier
                order_number: orderNumber,
                order_type: req.body.order_type || "Dine-In",
                // Orders auto-start as Preparing — the kitchen is display-only.
                order_status: req.body.order_status || "Preparing",
                payment_status: req.body.payment_status || "Pending",
                subtotal,
                discount: req.body.discount || 0,
                tax,
                service_charge,
                grand_total
            };

            orderModel.createOrder(order, (err, result) => {

                if (err) return error(res, err.message, 500);

                const orderId = result.insertId;

                orderModel.createOrderItems(pricedItems, orderId, (err) => {

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

        });

    });

};

// ============================ Waiter board ============================

// GET /api/orders/running
exports.getRunningOrders = (req, res) => {

    // Waiters see only the orders they took; everyone else sees all running orders.
    const employeeId = req.user.role === "waiter" ? req.user.id : null;

    orderModel.getRunningOrders(req.user.restaurant_id, employeeId, (err, results) => {

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
// Body: { payment_method } — recorded against each settled order.
//      or { payments: [{method, amount}], final_total } for split payments.
// `final_total` is the cashier's charged total (may include per-bill charges
// that are not part of the stored order grand_total).
exports.settleTable = (req, res) => {

    // Support split payments: body may contain either a single
    // { payment_method } or an array of { method, amount } splits.
    const payments = Array.isArray(req.body.payments) && req.body.payments.length
        ? req.body.payments.map((p) => ({
              method: p.method,
              amount: Number(p.amount)
          }))
        : [{ method: req.body.payment_method || "Cash", amount: null }];

    const finalTotal = req.body.final_total == null ? null : Number(req.body.final_total);

    // Per-bill charges the cashier picked. Only the name/type/amount are read —
    // the rupee value is resolved server-side against the real subtotal, so a
    // charge cannot be worth whatever the screen says it is.
    const charges = Array.isArray(req.body.charges) ? req.body.charges : [];

    orderModel.settleTable(
        req.params.tableId,
        req.user.restaurant_id,
        payments,
        req.user.id,
        finalTotal,
        charges,
        (err) => {

            // A refused settle is the cashier's problem to act on (unserved
            // items, a total that no longer matches), not an internal fault.
            if (err) return error(res, err.message, 400);

            return success(res, "Table settled and freed.");

        }
    );

};

// ============================ Bills (cashier) ============================

// GET /api/orders/bills/today — today's settled bills for the Bills screen
exports.getTodaysBills = (req, res) => {

    orderModel.getTodaysBills(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Bills fetched.", results);

    });

};

// GET /api/orders/bills/:id — one bill's header (for the receipt)
exports.getBill = (req, res) => {

    orderModel.getBillById(req.params.id, req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        if (results.length === 0) return error(res, "Bill not found.", 404);

        return success(res, "Bill fetched.", results[0]);

    });

};

// POST /api/orders/:id/item — add an item to this specific bill.
// Body: { menu_item_id, quantity }
exports.addItemToOrder = (req, res) => {

    orderModel.addItemToOrder(
        req.params.id,
        req.user.restaurant_id,
        req.body.menu_item_id,
        req.body.quantity,
        (err, result) => {
            if (err) return error(res, err.message, 500);
            return success(res, "Item added to the bill.", result);
        }
    );

};

// PUT /api/orders/:id/rebill — recompute an edited bill and bring the recorded
// payment into line. Body: { payment_method }.
exports.rebillOrder = (req, res) => {

    orderModel.rebillOrder(
        req.params.id,
        req.user.restaurant_id,
        req.body.payment_method,
        (err, result) => {

            if (err) return error(res, err.message, 500);

            const delta = `${result.difference < 0 ? "-" : "+"}₹${Math.abs(result.difference).toFixed(2)}`;

            auditLog.log(
                req.user,
                "Billing",
                "Bill Corrected",
                `Order #${req.params.id}: total ₹${result.previousTotal.toFixed(2)} → ` +
                `₹${result.newTotal.toFixed(2)} (${delta}), reprinted by ${req.user.username}`
            );

            return success(res, "Bill corrected.", result);

        }
    );

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

    // Re-price from menu_items, exactly as createOrder does — an edit must not
    // be a way around the price the menu says.
    orderModel.priceCartItems(items, restaurantId, (err, pricedItems) => {

        if (err) return error(res, err.message, 400);

        getRates(restaurantId, (err, rates) => {

        if (err) return error(res, err.message, 500);

        const totals = computeTotals(pricedItems, rates);

        orderModel.updateOrderTotals(orderId, restaurantId, totals, (err) => {

            if (err) return error(res, err.message, 500);

            orderModel.deleteOrderItems(orderId, restaurantId, (err) => {

                if (err) return error(res, err.message, 500);

                orderModel.createOrderItems(pricedItems, orderId, (err) => {

                    if (err) return error(res, err.message, 500);

                    return success(res, "Order updated successfully.");

                });

            });

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
