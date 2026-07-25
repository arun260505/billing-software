const db = require("../config/db");

// Get all customers
const getAllCustomers = (callback) => {
    db.query(
        "SELECT * FROM customers ORDER BY customer_name ASC",
        callback
    );
};

// Get customer by ID
const getCustomerById = (id, callback) => {
    db.query(
        "SELECT * FROM customers WHERE id = ?",
        [id],
        callback
    );
};

// Create customer
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

// Update customer
const updateCustomer = (id, customer, callback) => {

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
        WHERE id=?
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
        id
    ], callback);
};

// Delete customer
const deleteCustomer = (id, callback) => {
    db.query(
        "DELETE FROM customers WHERE id = ?",
        [id],
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