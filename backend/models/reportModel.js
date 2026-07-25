const db = require("../config/db");

// Daily Sales
const getDailySales = (callback) => {

    const sql = `
        SELECT
            DATE(created_at) AS sale_date,
            COUNT(*) AS total_orders,
            SUM(grand_total) AS total_sales
        FROM orders
        WHERE payment_status = 'Paid'
        GROUP BY DATE(created_at)
        ORDER BY sale_date DESC
    `;

    db.query(sql, callback);

};

// Monthly Sales
const getMonthlySales = (callback) => {

    const sql = `
        SELECT
            DATE_FORMAT(created_at, '%Y-%m') AS month,
            COUNT(*) AS total_orders,
            SUM(grand_total) AS total_sales
        FROM orders
        WHERE payment_status = 'Paid'
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month DESC
    `;

    db.query(sql, callback);

};

// Payment Summary
const getPaymentSummary = (callback) => {

    const sql = `
        SELECT
            payment_method,
            COUNT(*) AS total_transactions,
            SUM(amount) AS total_amount
        FROM payments
        WHERE payment_status = 'Success'
        GROUP BY payment_method
    `;

    db.query(sql, callback);

};

// Top Selling Items
const getTopSellingItems = (callback) => {

    const sql = `
        SELECT
            mi.item_name,
            SUM(oi.quantity) AS quantity_sold,
            SUM(oi.total) AS total_sales
        FROM order_items oi
        INNER JOIN menu_items mi
            ON oi.menu_item_id = mi.id
        GROUP BY oi.menu_item_id
        ORDER BY quantity_sold DESC
        LIMIT 10
    `;

    db.query(sql, callback);

};

// Employee Sales
const getEmployeeSales = (callback) => {

    const sql = `
        SELECT
            u.full_name,
            COUNT(o.id) AS total_orders,
            SUM(o.grand_total) AS total_sales
        FROM orders o
        INNER JOIN users u
            ON o.employee_id = u.id
        WHERE o.payment_status = 'Paid'
        GROUP BY o.employee_id
        ORDER BY total_sales DESC
    `;

    db.query(sql, callback);

};

// Table Sales
const getTableSales = (callback) => {

    const sql = `
        SELECT
            dt.table_name,
            COUNT(o.id) AS total_orders,
            SUM(o.grand_total) AS total_sales
        FROM orders o
        INNER JOIN dining_tables dt
            ON o.table_id = dt.id
        WHERE o.payment_status = 'Paid'
        GROUP BY o.table_id
        ORDER BY total_sales DESC
    `;

    db.query(sql, callback);

};

module.exports = {
    getDailySales,
    getMonthlySales,
    getPaymentSummary,
    getTopSellingItems,
    getEmployeeSales,
    getTableSales
};