const paymentModel = require("../models/paymentModel");
const generatePaymentNumber = require("../utils/paymentNumber");

// Get all payments
exports.getAllPayments = (req, res) => {

    paymentModel.getAllPayments((err, results) => {

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

// Get payment by ID
exports.getPaymentById = (req, res) => {

    paymentModel.getPaymentById(req.params.id, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Payment not found"
            });
        }

        res.json({
            success: true,
            data: results[0]
        });

    });

};
exports.createPayment = (req, res) => {

    generatePaymentNumber(req.body.restaurant_id, (err, paymentNumber) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        req.body.payment_number = paymentNumber;
        req.body.payment_status = "Success";

        paymentModel.createPayment(req.body, (err, result) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            const orderId = req.body.order_id;

            paymentModel.getOrderById(orderId, (err, orderResult) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                if (orderResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Order not found"
                    });
                }

                const order = orderResult[0];

                paymentModel.getTotalPaid(orderId, (err, paidResult) => {

                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: err.message
                        });
                    }

                    const totalPaid = Number(paidResult[0].totalPaid);
                    const grandTotal = Number(order.grand_total);

                    let paymentStatus = "Pending";

                    if (totalPaid >= grandTotal) {
                        paymentStatus = "Paid";
                    } else if (totalPaid > 0) {
                        paymentStatus = "Partial";
                    }

                    paymentModel.updateOrderPaymentStatus(
                        orderId,
                        paymentStatus,
                        (err) => {

                            if (err) {
                                return res.status(500).json({
                                    success: false,
                                    message: err.message
                                });
                            }

                            if (paymentStatus === "Paid") {

                                paymentModel.updateOrderStatus(
                                    orderId,
                                    "Completed",
                                    (err) => {

                                        if (err) {
                                            return res.status(500).json({
                                                success: false,
                                                message: err.message
                                            });
                                        }

                                        if (order.table_id) {

                                            paymentModel.makeTableAvailable(
                                                order.table_id,
                                                (err) => {

                                                    if (err) {
                                                        return res.status(500).json({
                                                            success: false,
                                                            message: err.message
                                                        });
                                                    }

                                                    res.status(201).json({
                                                        success: true,
                                                        message: "Payment completed successfully",
                                                        payment_id: result.insertId,
                                                        payment_number: paymentNumber,
                                                        payment_status: paymentStatus
                                                    });

                                                }
                                            );

                                        } else {

                                            res.status(201).json({
                                                success: true,
                                                message: "Payment completed successfully",
                                                payment_id: result.insertId,
                                                payment_number: paymentNumber,
                                                payment_status: paymentStatus
                                            });

                                        }

                                    }
                                );

                            } else {

                                res.status(201).json({
                                    success: true,
                                    message: "Partial payment saved",
                                    payment_id: result.insertId,
                                    payment_number: paymentNumber,
                                    payment_status: paymentStatus
                                });

                            }

                        });

                });

            });

        });

    });

};
// Create payment
// Delete payment
exports.deletePayment = (req, res) => {

    paymentModel.deletePayment(req.params.id, (err) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Payment deleted successfully"
        });

    });

};