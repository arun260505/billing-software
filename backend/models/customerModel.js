const db = require("../config/db");

// Get all customers (tenant-scoped)
const getAllCustomers = (restaurantId, callback) => {
    db.query(
        "SELECT * FROM customers WHERE restaurant_id = ? ORDER BY customer_name ASC",
        [restaurantId],
        callback
    );
};

// Get customer by ID (tenant-scoped)
const getCustomerById = (id, restaurantId, callback) => {
    db.query(
        "SELECT * FROM customers WHERE id = ? AND restaurant_id = ?",
        [id, restaurantId],
        callback
    );
};

// Create customer (restaurant_id from caller)
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
            loyalty_points,
            total_orders,
            total_spent,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        customer.loyalty_points,
        customer.total_orders,
        customer.total_spent,
        customer.status
    ], callback);
};

// Update customer (tenant-scoped)
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
            loyalty_points=?,
            total_orders=?,
            total_spent=?,
            status=?
        WHERE id=? AND restaurant_id=?
    `;

    db.query(sql, [
        customer.customer_name,
        customer.mobile,
        customer.email,
        customer.gender,
        customer.date_of_birth,
        customer.address,
        customer.gst_number,
        customer.loyalty_points,
        customer.total_orders,
        customer.total_spent,
        customer.status,
        id,
        restaurantId
    ], callback);
};

// Delete customer (tenant-scoped)
const deleteCustomer = (id, restaurantId, callback) => {
    db.query(
        "DELETE FROM customers WHERE id = ? AND restaurant_id = ?",
        [id, restaurantId],
        callback
    );
};

module.exports = {
    getAllCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer
};
