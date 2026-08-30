const db = require("../config/db");

// Get all payments (tenant-scoped)
const getAllPayments = (restaurantId, callback) => {

    const sql = `
        SELECT
            p.*,
            o.order_number
        FROM payments p
        INNER JOIN orders o ON p.order_id = o.id
        WHERE p.restaurant_id = ? AND p.deleted_at IS NULL
        ORDER BY p.payment_date DESC
    `;

    db.query(sql, [restaurantId], callback);
};

// Get payment by ID (tenant-scoped)
const getPaymentById = (id, restaurantId, callback) => {

    db.query(
        "SELECT * FROM payments WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL",
        [id, restaurantId],
        callback
    );

};

// Create payment (restaurant_id set by controller from JWT)
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

// Delete payment (tenant-scoped)
const deletePayment = (id, restaurantId, callback) => {

    // Soft delete so the removal syncs to the cloud.
    db.query(
        "UPDATE payments SET deleted_at = NOW() WHERE id=? AND restaurant_id=? AND deleted_at IS NULL",
        [id, restaurantId],
        callback
    );

};

// Get order (tenant-scoped)
const getOrderById = (orderId, restaurantId, callback) => {

    db.query(
        "SELECT * FROM orders WHERE id = ? AND restaurant_id = ?",
        [orderId, restaurantId],
        callback
    );

};

// Get total already paid for an order (tenant-scoped)
const getTotalPaid = (orderId, restaurantId, callback) => {

    const sql = `
        SELECT IFNULL(SUM(amount),0) AS totalPaid
        FROM payments
        WHERE order_id = ?
          AND restaurant_id = ?
          AND payment_status = 'Success'
    `;

    db.query(sql, [orderId, restaurantId], callback);

};

// Update order payment status (tenant-scoped)
const updateOrderPaymentStatus = (orderId, restaurantId, status, callback) => {

    db.query(
        "UPDATE orders SET payment_status=? WHERE id=? AND restaurant_id=?",
        [status, orderId, restaurantId],
        callback
    );

};

// Update order status (tenant-scoped)
const updateOrderStatus = (orderId, restaurantId, status, callback) => {

    db.query(
        "UPDATE orders SET order_status=? WHERE id=? AND restaurant_id=?",
        [status, orderId, restaurantId],
        callback
    );

};

// Make table available (tenant-scoped)
const makeTableAvailable = (tableId, restaurantId, callback) => {

    db.query(
        "UPDATE dining_tables SET status='Available' WHERE id=? AND restaurant_id=?",
        [tableId, restaurantId],
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
