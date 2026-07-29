const db = require("../config/db");

// Get all active kitchen orders (tenant-scoped)
const getKitchenOrders = (restaurantId, callback) => {

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
        LEFT JOIN dining_tables dt ON o.table_id = dt.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.restaurant_id = ?
          AND o.order_status IN ('Pending','Preparing','Ready')
        ORDER BY o.created_at ASC
    `;

    db.query(sql, [restaurantId], callback);

};

// Get items for one kitchen order (tenant-scoped via parent order)
const getKitchenOrderItems = (orderId, restaurantId, callback) => {

    const sql = `
        SELECT
            oi.id,
            mi.item_name,
            oi.quantity,
            oi.notes
        FROM order_items oi
        INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE oi.order_id = ? AND o.restaurant_id = ?
    `;

    db.query(sql, [orderId, restaurantId], callback);

};

// Update kitchen status (tenant-scoped)
const updateKitchenStatus = (orderId, restaurantId, status, callback) => {

    db.query(
        "UPDATE orders SET order_status=? WHERE id=? AND restaurant_id=?",
        [status, orderId, restaurantId],
        callback
    );

};

module.exports = {
    getKitchenOrders,
    getKitchenOrderItems,
    updateKitchenStatus
};
