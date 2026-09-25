const paymentModel = require("../models/paymentModel");
const orderModel = require("../models/orderModel");
const generatePaymentNumber = require("../utils/paymentNumber");
const { success, error } = require("../utils/response");
const { isSalon } = require("../utils/businessType");

// Get all payments
exports.getAllPayments = (req, res) => {

    paymentModel.getAllPayments(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Payments fetched.", results);

    });

};

// Get payment by ID
exports.getPaymentById = (req, res) => {

    paymentModel.getPaymentById(req.params.id, req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        if (results.length === 0) return error(res, "Payment not found.", 404);

        return success(res, "Payment fetched.", results[0]);

    });

};

// Create payment (then reconcile order + table status)
exports.createPayment = (req, res) => {

    const restaurantId = req.user.restaurant_id;   // tenant from JWT, never the body
    const orderId = req.body.order_id;
    const amount = Number(req.body.amount) || 0;
    // Split lines are flagged by the bill screen — each is under the total on its
    // own but together they cover the whole bill, so they bypass the "full bill"
    // rule below.
    const isSplitLine = req.body.split === true || req.body.allow_partial === true;

    if (!orderId) return error(res, "Order is required.", 400);

    // Guard FIRST (before inserting anything): a RESTAURANT takes the full bill in
    // one go — no partial and no advance. A stray under-bill payment is exactly
    // what left an order stuck "Partial" and made the dashboard's Collection run
    // ahead of Sales. Salons may take partials/advances, so this is non-salon only.
    paymentModel.getOrderById(orderId, restaurantId, (err, orderResult) => {

        if (err) return error(res, err.message, 500);
        if (orderResult.length === 0) return error(res, "Order not found.", 404);

        const order = orderResult[0];
        const grandTotal = Number(order.grand_total);

        paymentModel.getTotalPaid(orderId, restaurantId, (err, paidBeforeResult) => {

            if (err) return error(res, err.message, 500);

            const paidBefore = Number(paidBeforeResult[0].totalPaid) || 0;
            const EPS = 0.5;   // rupees of rounding tolerance

            if (!isSalon(req.user)) {
                if (paidBefore >= grandTotal - EPS) {
                    return error(res, "This bill is already fully paid.", 400);
                }
                if (!isSplitLine && (paidBefore + amount) < grandTotal - EPS) {
                    return error(res, "Partial or advance payments aren't allowed — collect the full bill amount.", 400);
                }
            }

            generatePaymentNumber(restaurantId, (err, paymentNumber) => {

                if (err) return error(res, err.message, 500);

                const payment = {
                    ...req.body,
                    restaurant_id: restaurantId,
                    payment_number: paymentNumber,
                    payment_status: "Success"
                };
                // Not columns on the payments table — control flags only.
                delete payment.split;
                delete payment.allow_partial;

                paymentModel.createPayment(payment, (err, result) => {

                    if (err) return error(res, err.message, 500);

                    paymentModel.getTotalPaid(orderId, restaurantId, (err, paidResult) => {

                        if (err) return error(res, err.message, 500);

                        const totalPaid = Number(paidResult[0].totalPaid);

                        let paymentStatus = "Pending";
                        if (totalPaid >= grandTotal) {
                            paymentStatus = "Paid";
                        } else if (totalPaid > 0) {
                            paymentStatus = "Partial";
                        }

                        const finish = (message) => success(res, message, {
                            payment_id: result.insertId,
                            payment_number: paymentNumber,
                            payment_status: paymentStatus
                        }, 201);

                        paymentModel.updateOrderPaymentStatus(
                            orderId,
                            restaurantId,
                            paymentStatus,
                            (err) => {

                                if (err) return error(res, err.message, 500);

                                if (paymentStatus !== "Paid") {
                                    return finish("Partial payment saved.");
                                }

                                // Fully paid: complete the order and free the table.
                                paymentModel.updateOrderStatus(
                                    orderId,
                                    restaurantId,
                                    "Completed",
                                    (err) => {

                                        if (err) return error(res, err.message, 500);

                                        // Sale confirmed: reduce stock for any inventory
                                        // PRODUCTS on this bill (once, here — not at order
                                        // create, which the salon may cancel/recreate).
                                        // Best-effort — never block the payment.
                                        orderModel.deductProductStock(orderId, restaurantId, req.user.id, (stockErr) => {
                                            if (stockErr) console.error("Product stock deduction failed:", stockErr.message);
                                        });

                                        if (!order.table_id) {
                                            return finish("Payment completed successfully.");
                                        }

                                        paymentModel.makeTableAvailable(
                                            order.table_id,
                                            restaurantId,
                                            (err) => {
                                                if (err) return error(res, err.message, 500);
                                                return finish("Payment completed successfully.");
                                            }
                                        );

                                    }
                                );

                            }
                        );

                    });

                });

            });

        });

    });

};

// Delete payment
exports.deletePayment = (req, res) => {

    paymentModel.deletePayment(req.params.id, req.user.restaurant_id, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Payment deleted successfully.");

    });

};
