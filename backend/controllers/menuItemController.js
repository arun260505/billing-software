const menuItemModel = require("../models/menuItemModel");

// Get all menu items
exports.getAllMenuItems = (req, res) => {
    menuItemModel.getAllMenuItems((err, results) => {
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

// Get menu item by ID
exports.getMenuItemById = (req, res) => {
    menuItemModel.getMenuItemById(req.params.id, (err, results) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Menu item not found"
            });
        }

        res.json({
            success: true,
            data: results[0]
        });
    });
};

// Create menu item
exports.createMenuItem = (req, res) => {
    menuItemModel.createMenuItem(req.body, (err, result) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Menu item created successfully",
            id: result.insertId
        });
    });
};

// Update menu item
exports.updateMenuItem = (req, res) => {
    menuItemModel.updateMenuItem(req.params.id, req.body, (err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Menu item updated successfully"
        });
    });
};

// Delete menu item
exports.deleteMenuItem = (req, res) => {
    menuItemModel.deleteMenuItem(req.params.id, (err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Menu item deleted successfully"
        });
    });
};