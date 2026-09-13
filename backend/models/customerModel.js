const db = require("../config/db");

/*
| Visit figures are worked out from the bills themselves rather than read from
| customers.total_orders / total_spent. Nothing keeps those columns up to date,
| and a customer's bills can be rung up on the till and only reach the cloud a
| sync cycle later — counting the orders is right on both sides.
|
| Only completed (paid) bills count as a visit.
*/
const VISIT_STATS = `
    COUNT(o.id)                     AS visit_count,
    COALESCE(SUM(o.grand_total), 0) AS lifetime_spent,
    MAX(o.created_at)               AS last_visit
`;

const VISIT_JOIN = `
    LEFT JOIN orders o
        ON o.customer_id = c.id
       AND o.restaurant_id = c.restaurant_id
       AND o.order_status = 'Completed'
       AND o.deleted_at IS NULL
`;

// Get all customers with their visit figures, most recent visitors first
// (tenant-scoped).
const getAllCustomers = (restaurantId, callback) => {
    db.query(
        `SELECT c.*, ${VISIT_STATS}
         FROM customers c
         ${VISIT_JOIN}
         WHERE c.restaurant_id = ? AND c.deleted_at IS NULL
         GROUP BY c.id
         ORDER BY (MAX(o.created_at) IS NULL), MAX(o.created_at) DESC, c.customer_name ASC`,
        [restaurantId],
        callback
    );
};

// Get customer by ID (tenant-scoped)
const getCustomerById = (id, restaurantId, callback) => {
    db.query(
        `SELECT c.*, ${VISIT_STATS}
         FROM customers c
         ${VISIT_JOIN}
         WHERE c.id = ? AND c.restaurant_id = ? AND c.deleted_at IS NULL
         GROUP BY c.id`,
        [id, restaurantId],
        callback
    );
};

// The live customer holding this mobile number, if any (tenant-scoped). One
// number is one customer — it is how the front desk finds them again.
// `excludeId` skips the customer being edited.
const findByMobile = (restaurantId, mobile, excludeId, callback) => {
    db.query(
        `SELECT id, customer_name, mobile
         FROM customers
         WHERE restaurant_id = ? AND mobile = ? AND deleted_at IS NULL AND id <> ?
         ORDER BY id
         LIMIT 1`,
        [restaurantId, mobile, excludeId || 0],
        callback
    );
};

// Customers matching what the front desk has typed so far, for the billing
// screen's suggestion list (tenant-scoped). Digits search the mobile number,
// anything else the name; matches that START with the text come first.
const searchCustomers = (restaurantId, term, callback) => {
    const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
    const column = /^[0-9]+$/.test(term) ? "mobile" : "customer_name";

    db.query(
        `SELECT id, customer_name, mobile
         FROM customers
         WHERE restaurant_id = ? AND deleted_at IS NULL AND ${column} LIKE ?
         ORDER BY (${column} LIKE ?) DESC, customer_name ASC
         LIMIT 8`,
        [restaurantId, `%${escaped}%`, `${escaped}%`],
        callback
    );
};

// Create customer (restaurant_id from caller; fields already validated by the
// controller).
const createCustomer = (customer, callback) => {

    const sql = `
        INSERT INTO customers
        (
            restaurant_id,
            customer_name,
            mobile,
            email,
            gender,
            date_of_birth,
            address,
            gst_number,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        customer.restaurant_id,
        customer.customer_name,
        customer.mobile,
        customer.email,
        customer.gender,
        customer.date_of_birth,
        customer.address,
        customer.gst_number,
        customer.status
    ], callback);
};

// Update customer (tenant-scoped). Only the details a person can know about a
// customer — the loyalty / order counters used to be overwritten with whatever
// the request carried, NULL when it carried nothing.
const updateCustomer = (id, restaurantId, customer, callback) => {

    const sql = `
        UPDATE customers
        SET
            customer_name=?,
            mobile=?,
            email=?,
            gender=?,
            date_of_birth=?,
            address=?,
            gst_number=?,
            status=?
        WHERE id=? AND restaurant_id=? AND deleted_at IS NULL
    `;

    db.query(sql, [
        customer.customer_name,
        customer.mobile,
        customer.email,
        customer.gender,
        customer.date_of_birth,
        customer.address,
        customer.gst_number,
        customer.status,
        id,
        restaurantId
    ], callback);
};

// Delete customer (tenant-scoped)
const deleteCustomer = (id, restaurantId, callback) => {
    // Soft delete so the removal syncs to the cloud.
    db.query(
        "UPDATE customers SET deleted_at = NOW() WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL",
        [id, restaurantId],
        callback
    );
};

// Every bill rung up for one customer, newest first, with what was on it and
// how it was paid (tenant-scoped).
const getCustomerHistory = (id, restaurantId, callback) => {
    db.query(
        `SELECT
            o.id,
            o.order_number,
            o.order_status,
            o.payment_status,
            o.grand_total,
            o.created_at,
            u.full_name AS employee_name,
            st.full_name AS stylist_name,
            (SELECT GROUP_CONCAT(
                        CONCAT(mi.item_name, IF(oi.quantity > 1, CONCAT(' x', ROUND(oi.quantity)), ''))
                        ORDER BY oi.id SEPARATOR ', ')
               FROM order_items oi
               JOIN menu_items mi ON mi.id = oi.menu_item_id
              WHERE oi.order_id = o.id) AS items,
            (SELECT p.payment_method
               FROM payments p
              WHERE p.order_id = o.id AND p.payment_status = 'Success'
              ORDER BY p.id DESC LIMIT 1) AS payment_method
         FROM orders o
         LEFT JOIN users u ON u.id = o.employee_id
         LEFT JOIN users st ON st.id = o.stylist_id
         WHERE o.customer_id = ? AND o.restaurant_id = ? AND o.deleted_at IS NULL
         ORDER BY o.created_at DESC
         LIMIT 200`,
        [id, restaurantId],
        callback
    );
};

module.exports = {
    getAllCustomers,
    getCustomerById,
    findByMobile,
    searchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerHistory
};
