const tableModel = require("../models/tableModel");
const { success, error } = require("../utils/response");

// Maps the UI status keywords to the DB status vocabulary.
const UI_TO_DB = { FREE: "Available", OCCUPIED: "Occupied", BILLING: "Billing" };

// Get all tables
exports.getAllTables = (req, res) => {

    tableModel.getAllTables(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Tables fetched.", results);

    });

};

// Get table by ID
exports.getTableById = (req, res) => {

    tableModel.getTableById(req.params.id, req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        if (results.length === 0) return error(res, "Table not found.", 404);

        return success(res, "Table fetched.", results[0]);

    });

};

// Create table
exports.createTable = (req, res) => {

    const data = {
        ...req.body,
        restaurant_id: req.user.restaurant_id
    };

    tableModel.createTable(data, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Table created successfully.", { id: result.insertId }, 201);

    });

};

// Update table
exports.updateTable = (req, res) => {

    tableModel.updateTable(req.params.id, req.user.restaurant_id, req.body, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Table updated successfully.");

    });

};

// Delete table
exports.deleteTable = (req, res) => {

    tableModel.deleteTable(req.params.id, req.user.restaurant_id, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Table deleted successfully.");

    });

};

// Dashboard Statistics
exports.getDashboardStats = (req, res) => {

    tableModel.getDashboardStats(req.user.restaurant_id, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Table stats fetched.", result[0]);

    });

};

// PUT /api/tables/:id/status  — waiter board (FREE/OCCUPIED)
exports.updateTableStatus = (req, res) => {

    const { status } = req.body;

    if (!status || !UI_TO_DB[status]) {
        return error(res, "Invalid status. Must be FREE or OCCUPIED.", 400);
    }

    tableModel.updateStatus(
        req.params.id,
        req.user.restaurant_id,
        UI_TO_DB[status],
        (err, result) => {

            if (err) return error(res, err.message, 500);

            if (result.affectedRows === 0) return error(res, "Table not found.", 404);

            return success(res, `Table status updated to ${status}.`);

        }
    );

};
