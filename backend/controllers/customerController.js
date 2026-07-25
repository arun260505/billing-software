const customerModel = require("../models/customerModel");

// Get all customers
exports.getAllCustomers = (req, res) => {
    customerModel.getAllCustomers((err, results) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            data: results
        });
    });
};

// Get customer by ID
exports.getCustomerById = (req, res) => {
    customerModel.getCustomerById(req.params.id, (err, results) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        res.json({
            success: true,
            data: results[0]
        });
    });
};

// Create customer
exports.createCustomer = (req, res) => {
    customerModel.createCustomer(req.body, (err, result) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Customer created successfully",
            id: result.insertId
        });
    });
};

// Update customer
exports.updateCustomer = (req, res) => {
    customerModel.updateCustomer(req.params.id, req.body, (err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Customer updated successfully"
        });
    });
};

// Delete customer
exports.deleteCustomer = (req, res) => {
    customerModel.deleteCustomer(req.params.id, (err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Customer deleted successfully"
        });
    });
};