const db = require("../config/db");

// Dashboard Summary
const getSummary = (callback) => {

    const sql = `
        SELECT
            (SELECT COUNT(*) FROM orders WHERE DATE(created_at)=CURDATE()) AS total_orders,

            (SELECT IFNULL(SUM(grand_total),0)
             FROM orders
             WHERE DATE(created_at)=CURDATE()
             AND payment_status='Paid') AS total_sales,

            (SELECT COUNT(*)
             FROM dining_tables
             WHERE status='Occupied') AS occupied_tables,

            (SELECT COUNT(*)
             FROM customers) AS total_customers
    `;

    db.query(sql, callback);

};

// Today's Sales
const getTodaysSales = (callback) => {

    db.query(`
        SELECT
            order_number,
            grand_total,
            payment_status,
            created_at
        FROM orders
        WHERE DATE(created_at)=CURDATE()
        ORDER BY created_at DESC
    `, callback);

};

// Recent Orders
const getRecentOrders = (callback) => {

    db.query(`
        SELECT
            order_number,
            order_status,
            payment_status,
            grand_total,
            created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 10
    `, callback);

};

// Top Selling Items
const getTopItems = (callback) => {

    const sql = `
        SELECT
            mi.item_name,
            SUM(oi.quantity) AS total_qty

        FROM order_items oi

        INNER JOIN menu_items mi
            ON oi.menu_item_id=mi.id

        GROUP BY oi.menu_item_id

        ORDER BY total_qty DESC

        LIMIT 10
    `;

    db.query(sql, callback);

};

// Table Status
const getTableStatus = (callback) => {

    db.query(`
        SELECT
            table_name,
            status
        FROM dining_tables
        ORDER BY table_name
    `, callback);

};
const getSalesChart = (period, callback) => {

    let sql = "";

    if (period === "today") {

        sql = `
            SELECT
                HOUR(created_at) AS label,
                SUM(grand_total) AS sales
            FROM orders
            WHERE DATE(created_at) = CURDATE()
              AND payment_status='Paid'
            GROUP BY HOUR(created_at)
            ORDER BY HOUR(created_at)
        `;

    }
    else if (period === "week") {

        sql = `
            SELECT
                DATE(created_at) AS label,
                SUM(grand_total) AS sales
            FROM orders
            WHERE YEARWEEK(created_at,1)=YEARWEEK(CURDATE(),1)
              AND payment_status='Paid'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `;

    }
    else {

        sql = `
            SELECT
                DATE(created_at) AS label,
                SUM(grand_total) AS sales
            FROM orders
            WHERE MONTH(created_at)=MONTH(CURDATE())
              AND YEAR(created_at)=YEAR(CURDATE())
              AND payment_status='Paid'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `;

    }

    db.query(sql, callback);

};



    module.exports = {
    getSummary,
    getTodaysSales,
    getRecentOrders,
    getTopItems,
    getTableStatus,
    getSalesChart
};