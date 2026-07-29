const menuModel = require("../models/menuModel");
const { success, error } = require("../utils/response");

// Get All Menu Items
exports.getAllMenuItems = (req, res) => {

    menuModel.getAllMenuItems(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Menu items fetched.", results);

    });

};

// Summary
exports.getSummary = (req, res) => {

    menuModel.getSummary(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Menu summary fetched.", results[0]);

    });

};

// Add Menu Item
exports.addMenuItem = (req, res) => {

    const data = {
        ...req.body,
        restaurant_id: req.user.restaurant_id
    };

    menuModel.addMenuItem(data, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Menu item added successfully.", null, 201);

    });

};

// Update Menu Item
exports.updateMenuItem = (req, res) => {

    menuModel.updateMenuItem(
        req.params.id,
        req.user.restaurant_id,
        req.body,
        (err) => {

            if (err) return error(res, err.message, 500);

            return success(res, "Menu item updated successfully.");

        }
    );

};

// Delete Menu Item
exports.deleteMenuItem = (req, res) => {

    menuModel.deleteMenuItem(
        req.params.id,
        req.user.restaurant_id,
        (err) => {

            if (err) return error(res, err.message, 500);

            return success(res, "Menu item deleted successfully.");

        }
    );

};
