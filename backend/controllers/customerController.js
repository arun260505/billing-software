const customerModel = require("../models/customerModel");
const { success, error } = require("../utils/response");

// Get all customers
exports.getAllCustomers = (req, res) => {

    customerModel.getAllCustomers(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Customers fetched.", results);

    });

};

// Get customer by ID
exports.getCustomerById = (req, res) => {

    customerModel.getCustomerById(req.params.id, req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        if (results.length === 0) return error(res, "Customer not found.", 404);

        return success(res, "Customer fetched.", results[0]);

    });

};

// Create customer
exports.createCustomer = (req, res) => {

    const data = {
        ...req.body,
        restaurant_id: req.user.restaurant_id
    };

    customerModel.createCustomer(data, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Customer created successfully.", { id: result.insertId }, 201);

    });

};

// Update customer
exports.updateCustomer = (req, res) => {

    customerModel.updateCustomer(req.params.id, req.user.restaurant_id, req.body, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Customer updated successfully.");

    });

};

// Delete customer
exports.deleteCustomer = (req, res) => {

    customerModel.deleteCustomer(req.params.id, req.user.restaurant_id, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Customer deleted successfully.");

    });

};
