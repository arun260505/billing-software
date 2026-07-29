const paymentModel = require("../models/paymentModel");
const generatePaymentNumber = require("../utils/paymentNumber");
const { success, error } = require("../utils/response");

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

    generatePaymentNumber(restaurantId, (err, paymentNumber) => {

        if (err) return error(res, err.message, 500);

        const payment = {
            ...req.body,
            restaurant_id: restaurantId,
            payment_number: paymentNumber,
            payment_status: "Success"
        };

        paymentModel.createPayment(payment, (err, result) => {

            if (err) return error(res, err.message, 500);

            const orderId = payment.order_id;

            paymentModel.getOrderById(orderId, restaurantId, (err, orderResult) => {

                if (err) return error(res, err.message, 500);
                if (orderResult.length === 0) return error(res, "Order not found.", 404);

                const order = orderResult[0];

                paymentModel.getTotalPaid(orderId, restaurantId, (err, paidResult) => {

                    if (err) return error(res, err.message, 500);

                    const totalPaid = Number(paidResult[0].totalPaid);
                    const grandTotal = Number(order.grand_total);

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

};

// Delete payment
exports.deletePayment = (req, res) => {

    paymentModel.deletePayment(req.params.id, req.user.restaurant_id, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Payment deleted successfully.");

    });

};
