const db = require("../config/db");

const Order = {

    createOrder(orderData, callback) {

        const sql = `
            INSERT INTO orders
            (
                order_number,
                waiter_id,
                total_items,
                subtotal,
                gst_amount,
                grand_total,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                orderData.order_number,
                orderData.waiter_id,
                orderData.total_items,
                orderData.subtotal,
                orderData.gst_amount,
                orderData.grand_total,
                "Pending"
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
            SELECT *
            FROM orders
            ORDER BY created_at DESC
        `;

        db.query(sql, callback);

    },

    getOrderById(id, callback) {

        const sql = `
            SELECT *
            FROM orders
            WHERE id = ?
        `;

        db.query(sql, [id], callback);

    },

    getRunningOrders(callback) {

        const sql = `
            SELECT
                id,
                order_number,
                waiter_id,
                total_items,
                grand_total,
                status,
                created_at
            FROM orders
            WHERE status IN ('Pending','Preparing','Ready')
            ORDER BY created_at DESC
        `;

        db.query(sql, callback);

    },

    getOrderDetails(orderId, callback) {

        const sql = `
            SELECT
                oi.id,
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
                total_items = ?,
                subtotal = ?,
                gst_amount = ?,
                grand_total = ?
            WHERE id = ?
        `;

        db.query(
            sql,
            [
                orderData.total_items,
                orderData.subtotal,
                orderData.gst_amount,
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
        SET status = 'Cancelled'
        WHERE id = ?
    `;

    db.query(sql, [orderId], callback);

},

};

module.exports = Order;