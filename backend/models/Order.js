const db = require("../config/db");

const Order = {

    createOrder(orderData, callback) {

        const sql = `
            INSERT INTO orders
            (
                restaurant_id,
                employee_id,
                table_id,
                order_number,
                order_type,
                subtotal,
                tax,
                grand_total
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                orderData.restaurant_id,
                orderData.employee_id,
                orderData.table_id,
                orderData.order_number,
                orderData.order_type || "Dine-In",
                orderData.subtotal,
                orderData.tax,
                orderData.grand_total
            ],
            callback
        );

    },

    addOrderItem(orderItem, callback) {

        const sql = `
            INSERT INTO order_items
            (
                order_id,
                menu_item_id,
                quantity,
                price,
                total
            )
            VALUES (?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                orderItem.order_id,
                orderItem.menu_item_id,
                orderItem.quantity,
                orderItem.price,
                orderItem.total
            ],
            callback
        );

    },

    getOrders(callback) {

        const sql = `
            SELECT *, order_status AS status
            FROM orders
            ORDER BY created_at DESC
        `;

        db.query(sql, callback);

    },

    getOrderById(id, callback) {

        const sql = `
            SELECT *, order_status AS status
            FROM orders
            WHERE id = ?
        `;

        db.query(sql, [id], callback);

    },

    getRunningOrders(callback) {

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
            WHERE o.order_status IN ('Pending','Preparing','Ready')
            ORDER BY o.created_at DESC
        `;

        db.query(sql, callback);

    },

    getOrderDetails(orderId, callback) {

        const sql = `
            SELECT
                oi.id,
                oi.menu_item_id,
                mi.item_name,
                oi.quantity,
                oi.price,
                oi.total
            FROM order_items oi
            INNER JOIN menu_items mi
                ON oi.menu_item_id = mi.id
            WHERE oi.order_id = ?
        `;

        db.query(sql, [orderId], callback);

    },

    updateOrder(orderData, callback) {

        const sql = `
            UPDATE orders
            SET
                subtotal = ?,
                tax = ?,
                grand_total = ?
            WHERE id = ?
        `;

        db.query(
            sql,
            [
                orderData.subtotal,
                orderData.tax,
                orderData.grand_total,
                orderData.order_id
            ],
            callback
        );

    },

    deleteOrderItems(orderId, callback) {

        const sql = `
            DELETE FROM order_items
            WHERE order_id = ?
        `;

        db.query(sql, [orderId], callback);

    },

    addUpdatedOrderItem(orderItem, callback) {

        const sql = `
            INSERT INTO order_items
            (
                order_id,
                menu_item_id,
                quantity,
                price,
                total
            )
            VALUES (?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                orderItem.order_id,
                orderItem.menu_item_id,
                orderItem.quantity,
                orderItem.price,
                orderItem.total
            ],
            callback
        );

    },

    cancelOrder(orderId, callback) {

        const sql = `
            UPDATE orders
            SET order_status = 'Cancelled'
            WHERE id = ?
        `;

        db.query(sql, [orderId], callback);

    },

};

module.exports = Order;