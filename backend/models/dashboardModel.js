const db = require("../config/db");

// Dashboard Summary (tenant-scoped)
const getSummary = (restaurantId, callback) => {

    const sql = `
        SELECT
            (SELECT COUNT(*) FROM orders
             WHERE restaurant_id = ? AND DATE(created_at)=CURDATE()) AS total_orders,

            (SELECT IFNULL(SUM(grand_total),0) FROM orders
             WHERE restaurant_id = ? AND DATE(created_at)=CURDATE()
             AND payment_status='Paid') AS total_sales,

            (SELECT COUNT(*) FROM dining_tables
             WHERE restaurant_id = ? AND status='Occupied') AS occupied_tables,

            (SELECT COUNT(*) FROM customers
             WHERE restaurant_id = ?) AS total_customers
    `;

    db.query(sql, [restaurantId, restaurantId, restaurantId, restaurantId], callback);

};

// Today's Sales (tenant-scoped)
const getTodaysSales = (restaurantId, callback) => {

    db.query(`
        SELECT
            order_number,
            grand_total,
            payment_status,
            created_at
        FROM orders
        WHERE restaurant_id = ? AND DATE(created_at)=CURDATE()
        ORDER BY created_at DESC
    `, [restaurantId], callback);

};

// Recent Orders (tenant-scoped)
const getRecentOrders = (restaurantId, callback) => {

    db.query(`
        SELECT
            order_number,
            order_status,
            payment_status,
            grand_total,
            created_at
        FROM orders
        WHERE restaurant_id = ?
        ORDER BY created_at DESC
        LIMIT 10
    `, [restaurantId], callback);

};

// Top Selling Items (tenant-scoped via parent order)
const getTopItems = (restaurantId, callback) => {

    const sql = `
        SELECT
            mi.item_name,
            SUM(oi.quantity) AS total_qty
        FROM order_items oi
        INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.restaurant_id = ?
        GROUP BY oi.menu_item_id
        ORDER BY total_qty DESC
        LIMIT 10
    `;

    db.query(sql, [restaurantId], callback);

};

// Table Status (tenant-scoped)
const getTableStatus = (restaurantId, callback) => {

    db.query(`
        SELECT
            table_name,
            status
        FROM dining_tables
        WHERE restaurant_id = ?
        ORDER BY table_name
    `, [restaurantId], callback);

};

// Sales Chart (tenant-scoped)
const getSalesChart = (period, restaurantId, callback) => {

    let sql = "";

    if (period === "today") {

        sql = `
            SELECT
                HOUR(created_at) AS label,
                SUM(grand_total) AS sales
            FROM orders
            WHERE restaurant_id = ?
              AND DATE(created_at) = CURDATE()
              AND payment_status='Paid'
            GROUP BY HOUR(created_at)
            ORDER BY HOUR(created_at)
        `;

    } else if (period === "week") {

        sql = `
            SELECT
                DATE(created_at) AS label,
                SUM(grand_total) AS sales
            FROM orders
            WHERE restaurant_id = ?
              AND YEARWEEK(created_at,1)=YEARWEEK(CURDATE(),1)
              AND payment_status='Paid'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `;

    } else {

        sql = `
            SELECT
                DATE(created_at) AS label,
                SUM(grand_total) AS sales
            FROM orders
            WHERE restaurant_id = ?
              AND MONTH(created_at)=MONTH(CURDATE())
              AND YEAR(created_at)=YEAR(CURDATE())
              AND payment_status='Paid'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `;

    }

    db.query(sql, [restaurantId], callback);

};

module.exports = {
    getSummary,
    getTodaysSales,
    getRecentOrders,
    getTopItems,
    getTableStatus,
    getSalesChart
};
