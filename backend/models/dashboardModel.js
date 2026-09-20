const db = require("../config/db");

// The date to treat as "today" in a query. The cloud DB runs in UTC while
// timestamps are stored as IST wall-clock, so the server's CURDATE() is a day
// behind between IST midnight and 05:30 — every "today" figure would read zero.
// Callers pass the client's local (IST) date "YYYY-MM-DD"; we splice it in as a
// literal (validated, so it's injection-safe). Falls back to CURDATE() when no
// valid date is given (e.g. an old caller, or the till which already runs in IST).
const dayLiteral = (today) =>
    (typeof today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(today)) ? `'${today}'` : "CURDATE()";

// Dashboard Summary (tenant-scoped). One call returns every headline figure
// the Admin Dashboard reads — order/sales KPI plus today's payment split and
// live operational counters (tables, kitchen, pending bills, restaurant state).
const getSummary = (restaurantId, today, callback) => {

    const D = dayLiteral(today);

    const sql = (`
        SELECT
            (SELECT COUNT(*) FROM orders
             WHERE restaurant_id = ? AND DATE(created_at)=CURDATE()
               AND deleted_at IS NULL
               AND order_status <> 'Cancelled') AS total_orders,

            (SELECT IFNULL(SUM(grand_total),0) FROM orders
             WHERE restaurant_id = ? AND DATE(created_at)=CURDATE()
             AND deleted_at IS NULL
             AND payment_status='Paid') AS total_sales,

            -- Week runs Sunday..Saturday (YEARWEEK mode 0 = week starts Sunday).
            (SELECT IFNULL(SUM(grand_total),0) FROM orders
             WHERE restaurant_id = ? AND YEARWEEK(created_at, 0) = YEARWEEK(CURDATE(), 0)
             AND deleted_at IS NULL
             AND payment_status='Paid') AS week_sales,

            (SELECT IFNULL(SUM(grand_total),0) FROM orders
             WHERE restaurant_id = ? AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
             AND deleted_at IS NULL
             AND payment_status='Paid') AS month_sales,

            (SELECT COUNT(*) FROM dining_tables
             WHERE restaurant_id = ? AND status='Occupied') AS occupied_tables,

            (SELECT COUNT(*) FROM dining_tables
             WHERE restaurant_id = ?) AS total_tables,

            (SELECT COUNT(*) FROM orders
             WHERE restaurant_id = ?
             AND deleted_at IS NULL
             AND order_status IN ('Pending','Preparing','Ready')) AS kitchen_orders,

            (SELECT COUNT(*) FROM orders
             WHERE restaurant_id = ?
             AND deleted_at IS NULL
             AND order_status <> 'Cancelled'
             AND payment_status IN ('Pending','Partial')) AS pending_bills,

            (SELECT IFNULL(SUM(amount),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND deleted_at IS NULL
             AND DATE(payment_date)=CURDATE()) AS total_collection,

            (SELECT IFNULL(SUM(CASE WHEN payment_method='Cash' THEN amount END),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND deleted_at IS NULL
             AND DATE(payment_date)=CURDATE()) AS cash_amount,

            (SELECT IFNULL(SUM(CASE WHEN payment_method='UPI' THEN amount END),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND deleted_at IS NULL
             AND DATE(payment_date)=CURDATE()) AS upi_amount,

            (SELECT IFNULL(SUM(CASE WHEN payment_method='Card' THEN amount END),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND deleted_at IS NULL
             AND DATE(payment_date)=CURDATE()) AS card_amount,

            (SELECT IFNULL(SUM(CASE WHEN payment_method='Wallet' THEN amount END),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND deleted_at IS NULL
             AND DATE(payment_date)=CURDATE()) AS wallet_amount,

            (SELECT IFNULL(SUM(CASE WHEN payment_method IN ('Bank Transfer','Split') THEN amount END),0) FROM payments
             WHERE restaurant_id = ? AND payment_status='Success'
             AND deleted_at IS NULL
             AND DATE(payment_date)=CURDATE()) AS other_amount,

            -- Salon dashboard: distinct customers billed today, and stock
            -- items at or below their reorder level.
            (SELECT COUNT(DISTINCT customer_id) FROM orders
             WHERE restaurant_id = ? AND DATE(created_at)=CURDATE()
               AND deleted_at IS NULL
               AND customer_id IS NOT NULL
               AND order_status <> 'Cancelled') AS customers_today,

            (SELECT COUNT(*) FROM inventory_items
             WHERE restaurant_id = ? AND deleted_at IS NULL
               AND status = 'Active' AND quantity <= min_quantity) AS low_stock_items,

            (
                (SELECT COUNT(*) FROM orders WHERE restaurant_id = ? AND (synced_at IS NULL OR updated_at > synced_at)) +
                (SELECT COUNT(*) FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?) AND (synced_at IS NULL OR updated_at > synced_at)) +
                (SELECT COUNT(*) FROM payments WHERE restaurant_id = ? AND (synced_at IS NULL OR updated_at > synced_at)) +
                (SELECT COUNT(*) FROM customers WHERE restaurant_id = ? AND (synced_at IS NULL OR updated_at > synced_at))
            ) AS pending_sync,

            (SELECT restaurant_name FROM restaurants WHERE id=?) AS restaurant_name,

            -- True business day status (opened at the counter)
            (SELECT COUNT(*) > 0 FROM day_closures WHERE restaurant_id = ? AND status = 'open' AND deleted_at IS NULL) AS day_is_open,

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
    `).replace(/CURDATE\(\)/g, D);

    // Every placeholder in this query is the same restaurant id, and the list
    // was a hand-counted row of 16. Deriving the count from the SQL means adding
    // or removing a subquery can't silently shift the bindings by one.
    const params = new Array((sql.match(/\?/g) || []).length).fill(restaurantId);

    db.query(sql, params, callback);

};

// Today's Sales (tenant-scoped)
const getTodaysSales = (restaurantId, today, callback) => {

    const D = dayLiteral(today);
    db.query((`
        SELECT
            order_number,
            grand_total,
            payment_status,
            created_at
        FROM orders
        WHERE restaurant_id = ? AND DATE(created_at)=CURDATE()
          AND deleted_at IS NULL
        ORDER BY created_at DESC
    `).replace(/CURDATE\(\)/g, D), [restaurantId], callback);

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
          AND o.deleted_at IS NULL
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
          AND o.deleted_at IS NULL
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
const getSalesChart = (period, restaurantId, today, callback) => {

    const D = dayLiteral(today);
    let sql = "";

    if (period === "today") {

        sql = `
            SELECT
                HOUR(created_at) AS label,
                SUM(grand_total) AS sales
            FROM orders
            WHERE restaurant_id = ?
              AND DATE(created_at) = CURDATE()
              AND deleted_at IS NULL
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
              AND deleted_at IS NULL
              AND payment_status='Paid'
            GROUP BY HOUR(created_at)
            ORDER BY HOUR(created_at)
        `;

    } else if (period === "week") {

        sql = `
            SELECT
                DATE_FORMAT(created_at, '%Y-%m-%d') AS label,
                SUM(grand_total) AS sales
            FROM orders
            WHERE restaurant_id = ?
              AND YEARWEEK(created_at,0)=YEARWEEK(CURDATE(),0)
              AND deleted_at IS NULL
              AND payment_status='Paid'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `;

    } else {

        sql = `
            SELECT
                DATE_FORMAT(created_at, '%Y-%m-%d') AS label,
                SUM(grand_total) AS sales
            FROM orders
            WHERE restaurant_id = ?
              AND MONTH(created_at)=MONTH(CURDATE())
              AND YEAR(created_at)=YEAR(CURDATE())
              AND deleted_at IS NULL
              AND payment_status='Paid'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `;

    }

    db.query(sql.replace(/CURDATE\(\)/g, D), [restaurantId], callback);

};

// Salon: each stylist's day so far (tenant-scoped). Customers, bills and sales
// count paid bills only; unpaid_bills shows what's still open at the desk. Every
// active stylist is listed, including those with nothing yet, so the owner sees
// who is idle; an inactive one appears only if they billed today.
const getStylistBoard = (restaurantId, today, callback) => {

    const D = dayLiteral(today);
    const sql = (`
        SELECT
            u.id,
            u.full_name,
            COUNT(DISTINCT CASE WHEN o.order_status = 'Completed' THEN o.customer_id END) AS customers,
            COALESCE(SUM(o.order_status = 'Completed'), 0) AS bills,
            COALESCE(SUM(o.order_status = 'Pending'), 0) AS unpaid_bills,
            COALESCE(SUM(CASE WHEN o.order_status = 'Completed' THEN o.grand_total END), 0) AS sales,
            (SELECT COALESCE(SUM(oi.quantity), 0)
               FROM order_items oi
               JOIN orders o2 ON o2.id = oi.order_id
              WHERE o2.stylist_id = u.id
                AND o2.restaurant_id = u.restaurant_id
                AND o2.order_status = 'Completed'
                AND o2.deleted_at IS NULL
                AND DATE(o2.created_at) = CURDATE()) AS services,
            MAX(CASE WHEN o.order_status = 'Completed' THEN o.created_at END) AS last_bill_at
        FROM users u
        LEFT JOIN orders o
               ON o.stylist_id = u.id
              AND o.restaurant_id = u.restaurant_id
              AND o.order_status IN ('Completed', 'Pending')
              AND o.deleted_at IS NULL
              AND DATE(o.created_at) = CURDATE()
        WHERE u.restaurant_id = ?
          AND u.role = 'stylist'
          AND u.deleted_at IS NULL
        GROUP BY u.id, u.full_name, u.status
        HAVING u.status = 'Active' OR bills > 0
        ORDER BY sales DESC, customers DESC, u.full_name ASC
    `).replace(/CURDATE\(\)/g, D);

    db.query(sql, [restaurantId], callback);

};

// Restaurant: each order-taker's day so far (tenant-scoped) — waiters AND
// cashiers, so a counter-only shop (no waiters) still sees who billed. Orders,
// items, bills and sales count every order created today that isn't cancelled;
// bills and sales additionally require the order to be paid (the same rule the
// summary cards use). Every active staff member is listed, including those with
// no orders yet, so the owner sees who is idle; an inactive one appears only if
// they took an order today. Items are counted through the order's order_items
// rows, so "items" is the quantity of menu items handled, not the bill count.
const getWaiterBoard = (restaurantId, today, callback) => {

    const D = dayLiteral(today);
    const sql = (`
        SELECT
            u.id,
            u.full_name,
            u.role,
            COALESCE(SUM(o.order_status <> 'Cancelled'), 0) AS orders,
            COALESCE(SUM(it.items_qty), 0) AS items,
            COALESCE(SUM(o.order_status <> 'Cancelled' AND o.payment_status = 'Paid'), 0) AS bills,
            COALESCE(SUM(CASE
                WHEN o.order_status <> 'Cancelled' AND o.payment_status = 'Paid'
                THEN o.grand_total END), 0) AS sales,
            MAX(CASE WHEN o.order_status <> 'Cancelled' THEN o.created_at END) AS last_order_at
        FROM users u
        LEFT JOIN orders o
               ON o.employee_id = u.id
              AND o.restaurant_id = u.restaurant_id
              AND o.order_status <> 'Cancelled'
              AND o.deleted_at IS NULL
              AND DATE(o.created_at) = CURDATE()
        LEFT JOIN (
                -- Item quantity per order, only for today's live orders.
                SELECT o2.id AS order_id,
                       COALESCE(SUM(oi.quantity), 0) AS items_qty
                FROM orders o2
                INNER JOIN order_items oi ON oi.order_id = o2.id
                WHERE o2.restaurant_id = ?
                  AND o2.deleted_at IS NULL
                  AND o2.order_status <> 'Cancelled'
                  AND DATE(o2.created_at) = CURDATE()
                GROUP BY o2.id
            ) it ON it.order_id = o.id
        WHERE u.restaurant_id = ?
          AND u.role IN ('waiter', 'cashier')
          AND u.deleted_at IS NULL
        GROUP BY u.id, u.full_name, u.role, u.status
        HAVING u.status = 'Active' OR orders > 0
        ORDER BY orders DESC, sales DESC, u.full_name ASC
    `).replace(/CURDATE\(\)/g, D);

    db.query(sql, [restaurantId, restaurantId], callback);

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
    getStylistBoard,
    getWaiterBoard,
    ping
};
