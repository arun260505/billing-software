const db = require("../config/db");

// Get all orders (tenant-scoped)
const getAllOrders = (restaurantId, callback) => {

    const sql = `
        SELECT
            o.*,
            c.customer_name,
            dt.table_name,
            u.full_name AS employee_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN dining_tables dt ON o.table_id = dt.id
        LEFT JOIN users u ON o.employee_id = u.id
        WHERE o.restaurant_id = ?
        ORDER BY o.created_at DESC
    `;

    db.query(sql, [restaurantId], callback);
};

// Get order by ID (tenant-scoped)
const getOrderById = (id, restaurantId, callback) => {

    const sql = `
        SELECT *
        FROM orders
        WHERE id = ? AND restaurant_id = ?
    `;

    db.query(sql, [id, restaurantId], callback);
};

// Create order (restaurant_id + employee_id set by controller from JWT)
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

// Delete order (tenant-scoped)
const deleteOrder = (id, restaurantId, callback) => {

    db.query(
        "DELETE FROM orders WHERE id=? AND restaurant_id=?",
        [id, restaurantId],
        callback
    );

};

// Invoice header (tenant-scoped)
const getInvoiceByOrderId = (orderId, restaurantId, callback) => {

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
        LEFT JOIN restaurants r ON o.restaurant_id = r.id
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN dining_tables dt ON o.table_id = dt.id
        LEFT JOIN users u ON o.employee_id = u.id
        WHERE o.id = ? AND o.restaurant_id = ?
    `;

    db.query(sql, [orderId, restaurantId], callback);

};

// Invoice line items (tenant-scoped via parent order)
const getInvoiceItems = (orderId, restaurantId, callback) => {

    const sql = `
        SELECT
            oi.quantity,
            oi.price,
            oi.total,
            mi.item_name
        FROM order_items oi
        INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE oi.order_id = ? AND o.restaurant_id = ?
    `;

    db.query(sql, [orderId, restaurantId], callback);

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

// Update a table's status (tenant-scoped)
const updateTableStatus = (tableId, restaurantId, status, callback) => {

    db.query(
        "UPDATE dining_tables SET status = ? WHERE id = ? AND restaurant_id = ?",
        [status, tableId, restaurantId],
        callback
    );

};

// ---------------------------------------------------------------------------
// Waiter ordering support (tenant-scoped)
// ---------------------------------------------------------------------------

// Active/running orders for the waiter board
const getRunningOrders = (restaurantId, callback) => {

    const sql = `
        SELECT
            o.id,
            o.order_number,
            o.employee_id,
            o.table_id,
            (SELECT COALESCE(SUM(oi.quantity), 0)
             FROM order_items oi
             WHERE oi.order_id = o.id) AS total_items,
            o.grand_total,
            o.order_status AS status,
            o.created_at
        FROM orders o
        WHERE o.restaurant_id = ?
          AND o.order_status IN ('Pending','Preparing','Ready')
        ORDER BY o.created_at DESC
    `;

    db.query(sql, [restaurantId], callback);

};

// Line items for one order (tenant-scoped via parent order)
const getOrderDetails = (orderId, restaurantId, callback) => {

    const sql = `
        SELECT
            oi.id,
            oi.menu_item_id,
            mi.item_name,
            oi.quantity,
            oi.price,
            oi.total
        FROM order_items oi
        INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE oi.order_id = ? AND o.restaurant_id = ?
    `;

    db.query(sql, [orderId, restaurantId], callback);

};

// Update an order's totals (tenant-scoped)
const updateOrderTotals = (orderId, restaurantId, totals, callback) => {

    const sql = `
        UPDATE orders
        SET subtotal = ?, tax = ?, grand_total = ?
        WHERE id = ? AND restaurant_id = ?
    `;

    db.query(
        sql,
        [totals.subtotal, totals.tax, totals.grand_total, orderId, restaurantId],
        callback
    );

};

// Replace an order's items: delete existing then re-insert (only if the order
// belongs to this tenant).
const deleteOrderItems = (orderId, restaurantId, callback) => {

    const sql = `
        DELETE oi FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE oi.order_id = ? AND o.restaurant_id = ?
    `;

    db.query(sql, [orderId, restaurantId], callback);

};

// Soft-cancel an order (tenant-scoped)
const cancelOrder = (orderId, restaurantId, callback) => {

    db.query(
        "UPDATE orders SET order_status = 'Cancelled' WHERE id = ? AND restaurant_id = ?",
        [orderId, restaurantId],
        callback
    );

};

// A table's items across ALL its active (unpaid) orders — Pending..Served,
// excluding Completed/Cancelled. Merged by item for a read-only summary.
const getTableActiveItems = (tableId, restaurantId, callback) => {

    // Per order-item rows (each has its own served flag) so items can be
    // marked served individually.
    const sql = `
        SELECT
            oi.id,
            mi.item_name,
            oi.quantity,
            oi.price,
            oi.served
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE o.table_id = ? AND o.restaurant_id = ?
          AND o.order_status IN ('Pending','Preparing','Ready','Served')
        ORDER BY oi.id ASC
    `;

    db.query(sql, [tableId, restaurantId], callback);

};

// Mark one order Served (waiter delivered it) — leaves the kitchen display.
const markServed = (orderId, restaurantId, callback) => {

    db.query(
        `UPDATE orders SET order_status='Served'
         WHERE id=? AND restaurant_id=?
           AND order_status IN ('Pending','Preparing','Ready')`,
        [orderId, restaurantId],
        callback
    );

};

// Mark a single order-item served; if all items in its order are then served,
// the order itself becomes Served (and drops off the kitchen display).
const markItemServed = (itemId, restaurantId, callback) => {

    db.query(
        `UPDATE order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         SET oi.served = 1
         WHERE oi.id = ? AND o.restaurant_id = ?`,
        [itemId, restaurantId],
        (err) => {
            if (err) return callback(err);

            db.query(
                `SELECT o.id AS orderId,
                        SUM(oi2.served = 0) AS unserved
                 FROM order_items oi
                 INNER JOIN orders o ON oi.order_id = o.id
                 INNER JOIN order_items oi2 ON oi2.order_id = o.id
                 WHERE oi.id = ? AND o.restaurant_id = ?
                 GROUP BY o.id`,
                [itemId, restaurantId],
                (err, rows) => {
                    if (err) return callback(err);
                    if (!rows.length) return callback(null);

                    if (Number(rows[0].unserved) === 0) {
                        db.query(
                            `UPDATE orders SET order_status='Served'
                             WHERE id=? AND restaurant_id=?
                               AND order_status IN ('Pending','Preparing','Ready')`,
                            [rows[0].orderId, restaurantId],
                            callback
                        );
                    } else {
                        callback(null);
                    }
                }
            );
        }
    );

};

// Mark all of a table's active orders Served (waiter delivered the table's food).
const markTableServed = (tableId, restaurantId, callback) => {

    db.query(
        `UPDATE orders SET order_status='Served'
         WHERE table_id=? AND restaurant_id=?
           AND order_status IN ('Pending','Preparing','Ready')`,
        [tableId, restaurantId],
        callback
    );

};

// Settle a table: mark all its active orders Completed/Paid and free the table.
const settleTable = (tableId, restaurantId, callback) => {

    db.query(
        `UPDATE orders
         SET order_status='Completed', payment_status='Paid'
         WHERE table_id=? AND restaurant_id=?
           AND order_status IN ('Pending','Preparing','Ready','Served')`,
        [tableId, restaurantId],
        (err) => {
            if (err) return callback(err);
            db.query(
                "UPDATE dining_tables SET status='Available', current_bill=0 WHERE id=? AND restaurant_id=?",
                [tableId, restaurantId],
                callback
            );
        }
    );

};

// Cancel a single order-item before billing (waiter edits the bill). Deletes the
// item, recomputes its order's totals from the remaining items, and cancels the
// whole order if nothing is left. Tenant-scoped throughout.
const removeOrderItem = (itemId, restaurantId, callback) => {

    db.query(
        `SELECT o.id AS orderId
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         WHERE oi.id = ? AND o.restaurant_id = ?`,
        [itemId, restaurantId],
        (err, rows) => {
            if (err) return callback(err);
            if (!rows.length) return callback(null, { affectedRows: 0 });
            const orderId = rows[0].orderId;

            db.query(
                `DELETE oi FROM order_items oi
                 INNER JOIN orders o ON oi.order_id = o.id
                 WHERE oi.id = ? AND o.restaurant_id = ?`,
                [itemId, restaurantId],
                (err) => {
                    if (err) return callback(err);

                    db.query(
                        `SELECT COALESCE(SUM(oi.total), 0) AS subtotal, COUNT(*) AS cnt
                         FROM order_items oi WHERE oi.order_id = ?`,
                        [orderId],
                        (err, sumRows) => {
                            if (err) return callback(err);
                            const subtotal = Number(sumRows[0].subtotal) || 0;
                            const cnt = Number(sumRows[0].cnt) || 0;
                            const tax = Math.round(subtotal * 0.05 * 100) / 100;
                            const grand = Math.round((subtotal + tax) * 100) / 100;
                            const cancelClause = cnt === 0 ? ", order_status='Cancelled'" : "";

                            db.query(
                                `UPDATE orders
                                 SET subtotal=?, tax=?, grand_total=?${cancelClause}
                                 WHERE id=? AND restaurant_id=?`,
                                [subtotal, tax, grand, orderId, restaurantId],
                                (err) => callback(err, { orderId, remaining: cnt })
                            );
                        }
                    );
                }
            );
        }
    );

};

// Count of orders created today (tenant-scoped)
const getTodaysOrderCount = (restaurantId, callback) => {

    db.query(
        `SELECT COUNT(*) AS total
         FROM orders
         WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()
           AND order_status != 'Cancelled'`,
        [restaurantId],
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
    updateTableStatus,
    getRunningOrders,
    getOrderDetails,
    updateOrderTotals,
    deleteOrderItems,
    cancelOrder,
    getTodaysOrderCount,
    getTableActiveItems,
    settleTable,
    markServed,
    markTableServed,
    markItemServed,
    removeOrderItem
};
