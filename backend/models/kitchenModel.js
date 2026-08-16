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
        (err, result) => {
            if (err) return callback(err);
            // When the kitchen marks the whole order Served, flip every item's
            // served flag too, so the waiter/cashier per-item views stay in sync.
            if (status === "Served") {
                return db.query(
                    `UPDATE order_items oi
                       INNER JOIN orders o ON oi.order_id = o.id
                        SET oi.served = 1
                      WHERE oi.order_id = ? AND o.restaurant_id = ?`,
                    [orderId, restaurantId],
                    (err2) => callback(err2, result)
                );
            }
            callback(null, result);
        }
    );

};

// Active tickets WITH their items, in one call (tenant-scoped).
// Each order is a separate ticket — never merged.
const getKitchenTickets = (restaurantId, callback) => {

    const ordersSql = `
        SELECT
            o.id,
            o.order_number,
            o.order_status AS status,
            o.created_at,
            dt.table_name
        FROM orders o
        LEFT JOIN dining_tables dt ON o.table_id = dt.id
        WHERE o.restaurant_id = ?
          AND o.order_status IN ('Pending','Preparing','Ready')
        ORDER BY o.created_at ASC
    `;

    db.query(ordersSql, [restaurantId], (err, orders) => {

        if (err) return callback(err);
        if (orders.length === 0) return callback(null, []);

        const ids = orders.map((o) => o.id);

        const itemsSql = `
            SELECT
                oi.id,
                oi.order_id,
                mi.item_name,
                oi.quantity,
                oi.notes,
                oi.served
            FROM order_items oi
            INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
            INNER JOIN orders o ON oi.order_id = o.id
            WHERE o.restaurant_id = ? AND oi.order_id IN (?)
            ORDER BY oi.id ASC
        `;

        db.query(itemsSql, [restaurantId, ids], (err, items) => {

            if (err) return callback(err);

            const byOrder = {};
            items.forEach((it) => {
                (byOrder[it.order_id] = byOrder[it.order_id] || []).push({
                    id: it.id,
                    item_name: it.item_name,
                    quantity: it.quantity,
                    notes: it.notes,
                    served: it.served
                });
            });

            const tickets = orders.map((o) => ({
                ...o,
                items: byOrder[o.id] || []
            }));

            callback(null, tickets);

        });

    });

};

// Active kitchen items grouped by TABLE. Only tables currently 'Occupied' are
// included — once a table is billed ('Billing') it drops off (resets). Served
// items are still returned (struck through) until the table is billed/settled.
const getKitchenByTable = (restaurantId, callback) => {

    const sql = `
        SELECT
            dt.id           AS table_id,
            dt.table_name,
            oi.id           AS item_id,
            mi.item_name,
            oi.quantity,
            oi.notes,
            oi.served,
            o.order_number,
            o.created_at
        FROM dining_tables dt
        INNER JOIN orders o        ON o.table_id = dt.id AND o.restaurant_id = dt.restaurant_id
        INNER JOIN order_items oi  ON oi.order_id = o.id
        INNER JOIN menu_items mi   ON oi.menu_item_id = mi.id
        WHERE dt.restaurant_id = ?
          AND dt.status = 'Occupied'
          AND o.order_status IN ('Pending','Preparing','Ready','Served')
        ORDER BY dt.table_name ASC, oi.id ASC
    `;

    db.query(sql, [restaurantId], (err, rows) => {
        if (err) return callback(err);

        const byTable = {};
        const tables = [];
        rows.forEach((r) => {
            if (!byTable[r.table_id]) {
                byTable[r.table_id] = { table_id: r.table_id, table_name: r.table_name, items: [] };
                tables.push(byTable[r.table_id]);
            }
            byTable[r.table_id].items.push({
                id: r.item_id,
                item_name: r.item_name,
                quantity: r.quantity,
                notes: r.notes,
                served: r.served,
                order_number: r.order_number,
                created_at: r.created_at
            });
        });

        callback(null, tables);
    });

};

module.exports = {
    getKitchenOrders,
    getKitchenOrderItems,
    updateKitchenStatus,
    getKitchenTickets,
    getKitchenByTable
};
