const tableModel = require("../models/tableModel");

// Get all tables
exports.getAllTables = (req, res) => {

    tableModel.getAllTables((err, results) => {

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

// Get table by ID
exports.getTableById = (req, res) => {

    tableModel.getTableById(req.params.id, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Table not found"
            });
        }

        res.json({
            success: true,
            data: results[0]
        });

    });

};

// Create table
exports.createTable = (req, res) => {

    tableModel.createTable(req.body, (err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Table created successfully",
            id: result.insertId
        });

    });

};

// Update table
exports.updateTable = (req, res) => {

    tableModel.updateTable(req.params.id, req.body, (err) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Table updated successfully"
        });

    });

};

// Delete table
exports.deleteTable = (req, res) => {

    tableModel.deleteTable(req.params.id, (err) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Table deleted successfully"
        });

    });

};

// Dashboard Statistics
exports.getDashboardStats = (req, res) => {

    tableModel.getDashboardStats((err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            data: result[0]
        });

    });

};