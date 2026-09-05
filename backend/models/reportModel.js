const db = require("../config/db");

const q = (sql, params) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

// Daily Sales (tenant-scoped)
const getDailySales = (restaurantId, callback) => {

    const sql = `
        SELECT
            DATE(created_at) AS sale_date,
            COUNT(*) AS total_orders,
            SUM(grand_total) AS total_sales
        FROM orders
        WHERE restaurant_id = ?
          AND payment_status = 'Paid'
        GROUP BY DATE(created_at)
        ORDER BY sale_date DESC
    `;

    db.query(sql, [restaurantId], callback);

};

// Monthly Sales (tenant-scoped)
const getMonthlySales = (restaurantId, callback) => {

    const sql = `
        SELECT
            DATE_FORMAT(created_at, '%Y-%m') AS month,
            COUNT(*) AS total_orders,
            SUM(grand_total) AS total_sales
        FROM orders
        WHERE restaurant_id = ?
          AND payment_status = 'Paid'
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month DESC
    `;

    db.query(sql, [restaurantId], callback);

};

// Payment Summary (tenant-scoped)
const getPaymentSummary = (restaurantId, callback) => {

    const sql = `
        SELECT
            payment_method,
            COUNT(*) AS total_transactions,
            SUM(amount) AS total_amount
        FROM payments
        WHERE restaurant_id = ?
          AND payment_status = 'Success'
        GROUP BY payment_method
    `;

    db.query(sql, [restaurantId], callback);

};

// Top Selling Items (tenant-scoped)
const getTopSellingItems = (restaurantId, callback) => {

    const sql = `
        SELECT
            mi.item_name,
            SUM(oi.quantity) AS quantity_sold,
            SUM(oi.total) AS total_sales
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE o.restaurant_id = ?
        GROUP BY oi.menu_item_id, mi.item_name
        ORDER BY quantity_sold DESC
        LIMIT 10
    `;

    db.query(sql, [restaurantId], callback);

};

// Employee Sales (tenant-scoped)
const getEmployeeSales = (restaurantId, callback) => {

    const sql = `
        SELECT
            u.full_name,
            COUNT(o.id) AS total_orders,
            SUM(o.grand_total) AS total_sales
        FROM orders o
        INNER JOIN users u ON o.employee_id = u.id
        WHERE o.restaurant_id = ?
          AND o.payment_status = 'Paid'
        GROUP BY o.employee_id, u.full_name
        ORDER BY total_sales DESC
    `;

    db.query(sql, [restaurantId], callback);

};

// Table Sales (tenant-scoped)
const getTableSales = (restaurantId, callback) => {

    const sql = `
        SELECT
            dt.table_name,
            COUNT(o.id) AS total_orders,
            SUM(o.grand_total) AS total_sales
        FROM orders o
        INNER JOIN dining_tables dt ON o.table_id = dt.id
        WHERE o.restaurant_id = ?
          AND o.payment_status = 'Paid'
        GROUP BY o.table_id, dt.table_name
        ORDER BY total_sales DESC
    `;

    db.query(sql, [restaurantId], callback);

};

// Full overview payload for the Admin Reports page. Every query is scoped
// to the authenticated restaurant plus an inclusive date range, and every
// result is empty-safe so the UI can render clean empty states.
const getOverview = async ({ restaurantId, from, to }) => {

    const rangeFilter =
        "o.restaurant_id = ? AND o.order_status <> 'Cancelled' AND DATE(o.created_at) BETWEEN ? AND ?";

    const kpisSql = `
        SELECT
            COUNT(*) AS total_orders,
            IFNULL(SUM(CASE WHEN o.payment_status = 'Paid' THEN o.grand_total END), 0) AS paid_amount,
            IFNULL(SUM(CASE WHEN o.payment_status IN ('Pending','Partial') THEN o.grand_total END), 0) AS pending_amount,
            IFNULL(SUM(o.discount), 0) AS discounts,
            IFNULL(SUM(o.tax), 0) AS tax,
            IFNULL(AVG(CASE WHEN o.payment_status = 'Paid' THEN o.grand_total END), 0) AS avg_order_value
        FROM orders o
        WHERE ${rangeFilter}
    `;

    const cancelledSql = `
        SELECT COUNT(*) AS cancelled_orders
        FROM orders o
        WHERE o.restaurant_id = ? AND o.order_status = 'Cancelled'
          AND DATE(o.created_at) BETWEEN ? AND ?
    `;

    // Per-bill charges are stored on the order (orders.charges_total, itemised
    // in order_charges) and included in its grand_total.
    //
    // This used to read the payment surplus — SUM(p.amount - o.grand_total) —
    // because charges were paid beyond the stored total. That surplus is now
    // always zero, so reading it would report no charges at all.
    const chargesCollectedSql = `
        SELECT IFNULL(SUM(o.charges_total), 0) AS charges_collected
        FROM orders o
        WHERE o.restaurant_id = ?
          AND o.payment_status = 'Paid'
          AND o.order_status <> 'Cancelled'
          AND DATE(o.created_at) BETWEEN ? AND ?
    `;

    const seriesSql = `
        SELECT
            DATE(o.created_at) AS date,
            COUNT(*) AS orders,
            IFNULL(SUM(CASE WHEN o.payment_status = 'Paid' THEN o.grand_total END), 0) AS sales
        FROM orders o
        WHERE ${rangeFilter}
        GROUP BY DATE(o.created_at)
        ORDER BY DATE(o.created_at)
    `;

    const orderTypesSql = `
        SELECT
            o.order_type,
            COUNT(*) AS orders,
            IFNULL(SUM(o.grand_total), 0) AS sales
        FROM orders o
        WHERE ${rangeFilter}
        GROUP BY o.order_type
    `;

    const paymentMethodsSql = `
        SELECT
            p.payment_method,
            COUNT(*) AS transactions,
            IFNULL(SUM(p.amount), 0) AS amount
        FROM payments p
        INNER JOIN orders o ON p.order_id = o.id
        WHERE o.restaurant_id = ?
          AND p.payment_status = 'Success'
          AND DATE(p.payment_date) BETWEEN ? AND ?
        GROUP BY p.payment_method
    `;

    const pendingPaymentsSql = `
        SELECT COUNT(*) AS orders, IFNULL(SUM(o.grand_total), 0) AS amount
        FROM orders o
        WHERE ${rangeFilter} AND o.payment_status IN ('Pending','Partial')
    `;

    const topItemsSql = `
        SELECT
            mi.id,
            mi.item_name,
            IFNULL(c.category_name, 'Uncategorized') AS category_name,
            SUM(oi.quantity) AS qty,
            IFNULL(SUM(oi.total), 0) AS revenue
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE ${rangeFilter}
        GROUP BY oi.menu_item_id, mi.item_name, c.category_name
        ORDER BY qty DESC
        LIMIT 10
    `;

    const lowItemsSql = `
        SELECT mi.item_name,
               IFNULL(c.category_name, 'Uncategorized') AS category_name,
               mi.price
        FROM menu_items mi
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE mi.restaurant_id = ? AND mi.available = 1
          AND NOT EXISTS (
                SELECT 1
                FROM order_items oi
                INNER JOIN orders o ON oi.order_id = o.id
                WHERE oi.menu_item_id = mi.id
                  AND o.order_status <> 'Cancelled'
                  AND DATE(o.created_at) BETWEEN ? AND ?
          )
        ORDER BY mi.item_name
        LIMIT 8
    `;

    const peakHoursSql = `
        SELECT
            HOUR(o.created_at) AS hour,
            COUNT(*) AS orders,
            IFNULL(SUM(o.grand_total), 0) AS sales
        FROM orders o
        WHERE ${rangeFilter}
        GROUP BY HOUR(o.created_at)
        ORDER BY HOUR(o.created_at)
    `;

    const kitchenOrdersSql = `
        SELECT
            TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at) AS actual_min,
            (
                SELECT MAX(mi.preparation_time)
                FROM order_items oi
                INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
                WHERE oi.order_id = o.id
            ) AS expected_min
        FROM orders o
        WHERE o.restaurant_id = ?
          AND o.order_status IN ('Completed','Served')
          AND DATE(o.created_at) BETWEEN ? AND ?
    `;

    const kitchenCountsSql = `
        SELECT
            COUNT(*) AS kitchen_total,
            IFNULL(SUM(o.order_status IN ('Completed','Served')), 0) AS completed,
            IFNULL(SUM(o.order_status IN ('Pending','Preparing','Ready')), 0) AS in_progress
        FROM orders o
        WHERE ${rangeFilter}
    `;

    const staffSql = `
        SELECT
            u.full_name,
            COUNT(o.id) AS orders,
            IFNULL(SUM(o.grand_total), 0) AS sales
        FROM orders o
        INNER JOIN users u ON o.employee_id = u.id
        WHERE ${rangeFilter}
        GROUP BY o.employee_id, u.full_name
        ORDER BY sales DESC
        LIMIT 10
    `;

    const tablesSql = `
        SELECT
            dt.table_name,
            COUNT(o.id) AS orders,
            IFNULL(SUM(o.grand_total), 0) AS sales
        FROM orders o
        INNER JOIN dining_tables dt ON o.table_id = dt.id
        WHERE ${rangeFilter}
        GROUP BY o.table_id, dt.table_name
        ORDER BY sales DESC
    `;

    const chargesConfigSql = `
        SELECT charge_name, charge_type, charge_role, amount, auto_apply,
               applies_dinein, applies_takeaway, applies_delivery, apply_tax
        FROM charges
        WHERE restaurant_id = ? AND status = 'Active' AND deleted_at IS NULL
        ORDER BY charge_role, charge_name
    `;

    // The GST rate the bills were actually charged at. It used to come from
    // settings.tax_percentage, which the biller stopped reading when GST became
    // a charge row — so the report would have quoted a rate nobody was billed.
    // Several tax rows (CGST + SGST) add up to the effective rate.
    const settingsSql = `
        SELECT SUM(amount) AS tax_percentage
        FROM charges
        WHERE restaurant_id = ? AND status = 'Active' AND deleted_at IS NULL
          AND charge_role = 'Tax' AND charge_type = 'Percentage'
    `;

    const prevFrom = shiftDate(from, -(dayDiff(from, to) + 1));
    const prevTo = shiftDate(from, -1);

    const comparisonKpisSql = `
        SELECT
            COUNT(*) AS total_orders,
            IFNULL(SUM(CASE WHEN payment_status = 'Paid' THEN grand_total END), 0) AS total_sales,
            IFNULL(AVG(CASE WHEN payment_status = 'Paid' THEN grand_total END), 0) AS avg_order_value,
            IFNULL(SUM(tax), 0) AS tax
        FROM orders
        WHERE restaurant_id = ? AND order_status <> 'Cancelled'
          AND DATE(created_at) BETWEEN ? AND ?
    `;

    const [
        kpiRows, cancelledRows, chargesRows, seriesRows, orderTypeRows,
        methodRows, pendingRows, topItemRows, lowItemRows, peakRows,
        kitchenOrderRows, kitchenCountRows, staffRows, tableRows,
        chargeConfigRows, settingsRows, comparisonRows
    ] = await Promise.all([
        q(kpisSql, [restaurantId, from, to]),
        q(cancelledSql, [restaurantId, from, to]),
        q(chargesCollectedSql, [restaurantId, from, to]),
        q(seriesSql, [restaurantId, from, to]),
        q(orderTypesSql, [restaurantId, from, to]),
        q(paymentMethodsSql, [restaurantId, from, to]),
        q(pendingPaymentsSql, [restaurantId, from, to]),
        q(topItemsSql, [restaurantId, from, to]),
        q(lowItemsSql, [restaurantId, from, to]),
        q(peakHoursSql, [restaurantId, from, to]),
        q(kitchenOrdersSql, [restaurantId, from, to]),
        q(kitchenCountsSql, [restaurantId, from, to]),
        q(staffSql, [restaurantId, from, to]),
        q(tablesSql, [restaurantId, from, to]),
        q(chargesConfigSql, [restaurantId]),
        q(settingsSql, [restaurantId]),
        q(comparisonKpisSql, [restaurantId, prevFrom, prevTo])
    ]);

    // Fill missing calendar days so the trend chart never shows gaps.
    const seriesMap = {};
    seriesRows.forEach((r) => { seriesMap[dateKeyOf(r.date)] = r; });

    const salesSeries = [];
    for (
        let d = new Date(`${from}T00:00:00`);
        d <= new Date(`${to}T00:00:00`);
        d.setDate(d.getDate() + 1)
    ) {
        const key = localISO(d);
        const row = seriesMap[key];
        salesSeries.push({
            date: key,
            orders: row ? num(row.orders) : 0,
            sales: row ? num(row.sales) : 0
        });
    }

    let peak = null;
    const peakHours = peakRows.map((r) => ({
        hour: num(r.hour),
        label: `${String(num(r.hour)).padStart(2, "0")}:00`,
        orders: num(r.orders),
        sales: num(r.sales)
    }));
    if (peakHours.length > 0) {
        peak = peakHours.reduce((a, b) => (b.orders > a.orders ? b : a));
    }

    const finished = kitchenOrderRows
        .map((r) => ({
            actual: num(r.actual_min),
            expected: r.expected_min === null ? null : num(r.expected_min)
        }))
        .filter((k) => k.actual >= 0);

    const delayed = finished.filter(
        (k) => k.actual > (k.expected === null ? 15 : k.expected + 5)
    ).length;

    const avgPrep = finished.length
        ? Math.round(finished.reduce((s, k) => s + k.actual, 0) / finished.length)
        : null;

    const withExpected = finished.filter((k) => k.expected !== null);
    const avgExpected = withExpected.length
        ? Math.round(withExpected.reduce((s, k) => s + k.expected, 0) / withExpected.length)
        : null;

    let kitchenStatus = null;
    if (avgPrep !== null) {
        if (avgExpected) {
            const ratio = avgPrep / avgExpected;
            kitchenStatus = ratio <= 1.1 ? "good" : ratio <= 1.4 ? "warning" : "critical";
        } else {
            kitchenStatus = avgPrep <= 20 ? "good" : avgPrep <= 35 ? "warning" : "critical";
        }
    }

    const topTotalRevenue = topItemRows.reduce((s, r) => s + num(r.revenue), 0);
    const k = kpiRows[0] || {};
    const kc = kitchenCountRows[0] || {};
    const taxTotal = num(k.tax);
    const taxPercentage = settingsRows[0] && settingsRows[0].tax_percentage !== null
        ? num(settingsRows[0].tax_percentage)
        : null;
    const cmp = comparisonRows[0] || {};

    return {
        range: { from, to },
        kpis: {
            total_orders: num(k.total_orders),
            total_sales: num(k.paid_amount),
            paid_amount: num(k.paid_amount),
            pending_amount: num(k.pending_amount),
            discounts: num(k.discounts),
            tax: taxTotal,
            charges_collected: num(chargesRows[0] && chargesRows[0].charges_collected),
            avg_order_value: Math.round(num(k.avg_order_value)),
            cancelled_orders: num(cancelledRows[0] && cancelledRows[0].cancelled_orders)
        },
        comparison: {
            total_sales: num(cmp.total_sales),
            total_orders: num(cmp.total_orders),
            avg_order_value: Math.round(num(cmp.avg_order_value)),
            cancelled_orders: 0
        },
        sales_series: salesSeries,
        order_types: orderTypeRows.map((r) => ({
            order_type: r.order_type,
            orders: num(r.orders),
            sales: num(r.sales)
        })),
        payments: {
            methods: methodRows.map((r) => ({
                method: r.payment_method,
                transactions: num(r.transactions),
                amount: num(r.amount)
            })),
            pending: {
                orders: num(pendingRows[0] && pendingRows[0].orders),
                amount: num(pendingRows[0] && pendingRows[0].amount)
            }
        },
        top_items: topItemRows.map((r, i) => ({
            rank: i + 1,
            item_name: r.item_name,
            category_name: r.category_name,
            qty: num(r.qty),
            revenue: num(r.revenue),
            percentage: topTotalRevenue > 0
                ? Math.round((num(r.revenue) / topTotalRevenue) * 1000) / 10
                : 0
        })),
        low_items: lowItemRows.map((r) => ({
            item_name: r.item_name,
            category_name: r.category_name,
            price: num(r.price)
        })),
        peak_hours: peakHours,
        peak,
        kitchen: {
            total: num(kc.kitchen_total),
            completed: num(kc.completed),
            in_progress: num(kc.in_progress),
            cancelled: num(cancelledRows[0] && cancelledRows[0].cancelled_orders),
            delayed,
            avg_prep_min: avgPrep,
            expected_prep_min: avgExpected,
            status: kitchenStatus
        },
        staff: staffRows.map((r) => ({
            name: r.full_name,
            orders: num(r.orders),
            sales: num(r.sales),
            avg: num(r.orders) > 0 ? Math.round(num(r.sales) / num(r.orders)) : 0
        })),
        tables: tableRows.map((r) => ({
            table_name: r.table_name,
            orders: num(r.orders),
            sales: num(r.sales),
            avg: num(r.orders) > 0 ? Math.round(num(r.sales) / num(r.orders)) : 0
        })),
        charges_config: chargeConfigRows.map((r) => ({
            charge_name: r.charge_name,
            charge_type: r.charge_type,
            charge_role: r.charge_role || "Charge",
            auto_apply: !!r.auto_apply,
            amount: num(r.amount),
            applies_dinein: !!r.applies_dinein,
            applies_takeaway: !!r.applies_takeaway,
            applies_delivery: !!r.applies_delivery,
            apply_tax: !!r.apply_tax
        })),
        tax_summary: {
            total: taxTotal,
            cgst: Math.round((taxTotal / 2) * 100) / 100,
            sgst: Math.round((taxTotal / 2) * 100) / 100,
            percentage: taxPercentage
        }
    };

};

function dayDiff(from, to) {
    return Math.round(
        (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000
    );
}

// Local-date ISO string (avoids toISOString() shifting the date by a day
// in timezones ahead of UTC, e.g. IST).
function localISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function shiftDate(dateStr, days) {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    return localISO(d);
}

// mysql2 returns DATE columns as Date objects at local midnight and
// DATETIME as strings in some configs; normalise both to YYYY-MM-DD.
const dateKeyOf = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v.slice(0, 10);
    if (v instanceof Date && !Number.isNaN(v.getTime())) return localISO(v);
    return String(v).slice(0, 10);
};

module.exports = {
    getDailySales,
    getMonthlySales,
    getPaymentSummary,
    getTopSellingItems,
    getEmployeeSales,
    getTableSales,
    getOverview,
    q,
    num
};
