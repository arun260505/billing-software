const menuModel = require("../models/menuModel");
const { success, error } = require("../utils/response");

// ============================ Admin menu management ============================

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

// PATCH /api/menu/:id/availability — cashier/admin marks item available/unavailable
exports.setAvailability = (req, res) => {

    menuModel.setAvailability(req.params.id, req.user.restaurant_id, req.body.available, (err) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Availability updated.");

    });

};

// ============================ Waiter ordering screen ============================

// GET /api/menu/categories
exports.getCategories = (req, res) => {

    menuModel.getMenuCategories(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Categories fetched.", results);

    });

};

// GET /api/menu/items
exports.getAllItems = (req, res) => {

    menuModel.getWaiterItems(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Menu items fetched.", results);

    });

};

// GET /api/menu/items/category/:id
exports.getItemsByCategory = (req, res) => {

    menuModel.getWaiterItemsByCategory(req.params.id, req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Menu items fetched.", results);

    });

};
