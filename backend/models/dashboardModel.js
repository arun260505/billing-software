const db = require("../config/db");

// Dashboard Summary (tenant-scoped). One call returns every headline figure
// the Admin Dashboard reads — order/sales KPI plus today's payment split and
// live operational counters (tables, kitchen, pending bills, restaurant state).
const getSummary = (restaurantId, callback) => {

    const sql = `
        SELECT
            (SELECT COUNT(*) FROM orders
             WHERE restaurant_id = ? AND DATE(created_at)=CURDATE()
               AND order_status <> 'Cancelled') AS total_orders,

            (SELECT IFNULL(SUM(grand_total),0) FROM orders
             WHERE restaurant_id = ? AND DATE(created_at)=CURDATE()
             AND payment_status='Paid') AS total_sales,

            (SELECT COUNT(*) FROM dining_tables
             WHERE restaurant_id = ? AND status='Occupied') AS occupied_tables,

            (SELECT COUNT(*) FROM dining_tables
             WHERE restaurant_id = ?) AS total_tables,

            (SELECT COUNT(*) FROM orders
             WHERE restaurant_id = ?
             AND order_status IN ('Pending','Preparing','Ready')) AS kitchen_orders,

            (SELECT COUNT(*) FROM orders
             WHERE restaurant_id = ?
             AND order_status <> 'Cancelled'
             AND payment_status IN ('Pending','Partial')) AS pending_bills,

            (SELECT IFNULL(SUM(amount),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND DATE(payment_date)=CURDATE()) AS total_collection,

            (SELECT IFNULL(SUM(CASE WHEN payment_method='Cash' THEN amount END),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND DATE(payment_date)=CURDATE()) AS cash_amount,

            (SELECT IFNULL(SUM(CASE WHEN payment_method='UPI' THEN amount END),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND DATE(payment_date)=CURDATE()) AS upi_amount,

            (SELECT IFNULL(SUM(CASE WHEN payment_method='Card' THEN amount END),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND DATE(payment_date)=CURDATE()) AS card_amount,

            (SELECT IFNULL(SUM(CASE WHEN payment_method='Wallet' THEN amount END),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND DATE(payment_date)=CURDATE()) AS wallet_amount,

            (SELECT IFNULL(SUM(CASE WHEN payment_method IN ('Bank Transfer','Split') THEN amount END),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND DATE(payment_date)=CURDATE()) AS other_amount,

            (SELECT restaurant_name FROM restaurants WHERE id=?) AS restaurant_name,

            -- Opening hours and the open/closed switch live in BOTH tables, and
            -- Admin > Settings writes to the settings table while this read used
            -- the restaurants table. So changing the hours had no effect on the
            -- dashboard Open/Closed badge, and because restaurants.opening_time
            -- is normally NULL the badge fell through to "always Open".
            -- Prefer what Settings actually saves, fall back to the restaurant row.
            COALESCE(
                (SELECT restaurant_status FROM settings WHERE restaurant_id=?),
                (SELECT status FROM restaurants WHERE id=?)
            ) AS restaurant_status,
            COALESCE(
                (SELECT opening_time FROM settings WHERE restaurant_id=?),
                (SELECT opening_time FROM restaurants WHERE id=?)
            ) AS opening_time,
            COALESCE(
                (SELECT closing_time FROM settings WHERE restaurant_id=?),
                (SELECT closing_time FROM restaurants WHERE id=?)
            ) AS closing_time
    `;

    // Every placeholder in this query is the same restaurant id, and the list
    // was a hand-counted row of 16. Deriving the count from the SQL means adding
    // or removing a subquery can't silently shift the bindings by one.
    const params = new Array((sql.match(/\?/g) || []).length).fill(restaurantId);

    db.query(sql, params, callback);

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

// Recent Orders (tenant-scoped). Rich enough for the dashboard's Recent Orders
// table: type, item count and the latest successful payment method.
const getRecentOrders = (restaurantId, callback) => {

    db.query(`
        SELECT
            o.id,
            o.order_number,
            o.order_type,
            o.order_status,
            o.payment_status,
            o.grand_total,
            o.created_at,
            (SELECT COALESCE(SUM(oi.quantity), 0)
             FROM order_items oi WHERE oi.order_id = o.id) AS total_items,
            (SELECT p.payment_method
             FROM payments p
             WHERE p.order_id = o.id AND p.payment_status = 'Success'
             ORDER BY p.id DESC LIMIT 1) AS payment_method
        FROM orders o
        WHERE o.restaurant_id = ?
        ORDER BY o.created_at DESC
        LIMIT 10
    `, [restaurantId], callback);

};

// Top Selling Items (tenant-scoped via parent order) with revenue.
const getTopItems = (restaurantId, callback) => {

    const sql = `
        SELECT
            mi.item_name,
            SUM(oi.quantity) AS total_qty,
            SUM(oi.total) AS total_sales
        FROM order_items oi
        INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.restaurant_id = ?
          AND o.order_status <> 'Cancelled'
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

    } else if (period === "yesterday") {

        sql = `
            SELECT
                HOUR(created_at) AS label,
                SUM(grand_total) AS sales
            FROM orders
            WHERE restaurant_id = ?
              AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
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

// Trivial heartbeat used by the Connection Status widget — verifies the
// database connection is alive (tenant-agnostic).
const ping = (callback) => {
    db.query("SELECT 1 AS ok", callback);
};

module.exports = {
    getSummary,
    getTodaysSales,
    getRecentOrders,
    getTopItems,
    getTableStatus,
    getSalesChart,
    ping
};
