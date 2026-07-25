const db = require("../config/db");

// Get all kitchen orders
const getKitchenOrders = (callback) => {

    const sql = `
        SELECT
            o.id,
            o.order_number,
            o.order_type,
            o.order_status,
            o.created_at,

            dt.table_name,
            c.customer_name

        FROM orders o

        LEFT JOIN dining_tables dt
            ON o.table_id = dt.id

        LEFT JOIN customers c
            ON o.customer_id = c.id

        WHERE o.order_status IN ('Pending','Preparing','Ready')

        ORDER BY o.created_at ASC
    `;

    db.query(sql, callback);

};

// Get items for one kitchen order
const getKitchenOrderItems = (orderId, callback) => {

    const sql = `
        SELECT
            oi.id,
            mi.item_name,
            oi.quantity,
            oi.notes

        FROM order_items oi

        INNER JOIN menu_items mi
            ON oi.menu_item_id = mi.id

        WHERE oi.order_id = ?
    `;

    db.query(sql, [orderId], callback);

};

// Update kitchen status
const updateKitchenStatus = (orderId, status, callback) => {

    db.query(
        "UPDATE orders SET order_status=? WHERE id=?",
        [status, orderId],
        callback
    );

};

module.exports = {
    getKitchenOrders,
    getKitchenOrderItems,
    updateKitchenStatus
};