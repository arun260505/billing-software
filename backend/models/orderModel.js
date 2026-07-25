const db = require("../config/db");

// Get all orders
const getAllOrders = (callback) => {

    const sql = `
        SELECT
            o.*,
            c.customer_name,
            dt.table_name,
            u.name AS employee_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN dining_tables dt ON o.table_id = dt.id
        LEFT JOIN users u ON o.employee_id = u.id
        ORDER BY o.created_at DESC
    `;

    db.query(sql, callback);
};

// Get order by ID
const getOrderById = (id, callback) => {

    const sql = `
        SELECT *
        FROM orders
        WHERE id = ?
    `;

    db.query(sql, [id], callback);
};

// Create order
const createOrder = (order, callback) => {

    const sql = `
        INSERT INTO orders
        (
            restaurant_id,
            customer_id,
            table_id,
            employee_id,
            order_number,
            order_type,
            order_status,
            subtotal,
            discount,
            tax,
            grand_total,
            payment_status,
            notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        order.restaurant_id,
        order.customer_id,
        order.table_id,
        order.employee_id,
        order.order_number,
        order.order_type,
        order.order_status,
        order.subtotal,
        order.discount,
        order.tax,
        order.grand_total,
        order.payment_status,
        order.notes
    ], callback);
};

// Delete order
const deleteOrder = (id, callback) => {

    db.query(
        "DELETE FROM orders WHERE id=?",
        [id],
        callback
    );

};
const getInvoiceByOrderId = (orderId, callback) => {

    const sql = `
        SELECT
            o.id,
            o.order_number,
            o.order_type,
            o.order_status,
            o.payment_status,
            o.subtotal,
            o.tax,
            o.discount,
            o.grand_total,
            o.created_at,

            r.restaurant_name,
            r.address,
            r.mobile,

            c.customer_name,
            c.mobile AS customer_mobile,

            dt.table_name,

            u.full_name AS employee_name

        FROM orders o

        LEFT JOIN restaurants r
            ON o.restaurant_id = r.id

        LEFT JOIN customers c
            ON o.customer_id = c.id

        LEFT JOIN dining_tables dt
            ON o.table_id = dt.id

        LEFT JOIN users u
            ON o.employee_id = u.id

        WHERE o.id = ?
    `;

    db.query(sql, [orderId], callback);

};
const getInvoiceItems = (orderId, callback) => {

    const sql = `
        SELECT
            oi.quantity,
            oi.price,
            oi.total,

            mi.item_name

        FROM order_items oi

        INNER JOIN menu_items mi
            ON oi.menu_item_id = mi.id

        WHERE oi.order_id = ?
    `;

    db.query(sql, [orderId], callback);

};
const createOrderItems = (items, orderId, callback) => {

    if (!items || items.length === 0) {
        return callback(null);
    }

    const values = items.map(item => [
        orderId,
        item.menu_item_id,
        item.quantity,
        item.price,
        item.total,
        item.notes || null
    ]);

    const sql = `
        INSERT INTO order_items
        (order_id, menu_item_id, quantity, price, total, notes)
        VALUES ?
    `;

    db.query(sql, [values], callback);

};
const updateTableStatus = (tableId, status, callback) => {

    db.query(
        "UPDATE dining_tables SET status = ? WHERE id = ?",
        [status, tableId],
        callback
    );

};

module.exports = {
    getAllOrders,
    getOrderById,
    createOrder,
    createOrderItems,
    deleteOrder,
    getInvoiceByOrderId,
    getInvoiceItems,
    updateTableStatus

    
};