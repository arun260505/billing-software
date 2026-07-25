const db = require("../config/db");

// Get all payments
const getAllPayments = (callback) => {

    const sql = `
        SELECT
            p.*,
            o.order_number
        FROM payments p
        INNER JOIN orders o
            ON p.order_id = o.id
        ORDER BY p.payment_date DESC
    `;

    db.query(sql, callback);
};

// Get payment by ID
const getPaymentById = (id, callback) => {

    db.query(
        "SELECT * FROM payments WHERE id = ?",
        [id],
        callback
    );

};

// Create payment
const createPayment = (payment, callback) => {

    const sql = `
        INSERT INTO payments
        (
            restaurant_id,
            order_id,
            payment_number,
            payment_method,
            amount,
            reference_number,
            payment_status,
            remarks
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        payment.restaurant_id,
        payment.order_id,
        payment.payment_number,
        payment.payment_method,
        payment.amount,
        payment.reference_number,
        payment.payment_status,
        payment.remarks
    ], callback);

};

// Delete payment
const deletePayment = (id, callback) => {

    db.query(
        "DELETE FROM payments WHERE id=?",
        [id],
        callback
    );

};
// Get order total
const getOrderById = (orderId, callback) => {

    db.query(
        "SELECT * FROM orders WHERE id = ?",
        [orderId],
        callback
    );

};

// Get total paid
const getTotalPaid = (orderId, callback) => {

    const sql = `
        SELECT IFNULL(SUM(amount),0) AS totalPaid
        FROM payments
        WHERE order_id = ?
        AND payment_status = 'Success'
    `;

    db.query(sql, [orderId], callback);

};

// Update payment status
const updateOrderPaymentStatus = (orderId, status, callback) => {

    db.query(
        "UPDATE orders SET payment_status=? WHERE id=?",
        [status, orderId],
        callback
    );

};

// Update order status
const updateOrderStatus = (orderId, status, callback) => {

    db.query(
        "UPDATE orders SET order_status=? WHERE id=?",
        [status, orderId],
        callback
    );

};

// Make table available
const makeTableAvailable = (tableId, callback) => {

    db.query(
        "UPDATE dining_tables SET status='Available' WHERE id=?",
        [tableId],
        callback
    );

};

module.exports = {
    getAllPayments,
    getPaymentById,
    createPayment,
    deletePayment,

    getOrderById,
    getTotalPaid,
    updateOrderPaymentStatus,
    updateOrderStatus,
    makeTableAvailable
};