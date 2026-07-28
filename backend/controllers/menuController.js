const menuModel = require("../models/menuModel");

// Get All Menu Items
exports.getAllMenuItems = (req, res) => {

    menuModel.getAllMenuItems((err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json(results);

    });

};

// Get Dashboard Summary
exports.getSummary = (req, res) => {

    menuModel.getSummary((err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json(results[0]);

    });

};

// Add Menu Item
// Add Menu Item
exports.addMenuItem = (req, res) => {

    console.log("===== MENU REQUEST =====");
    console.log("req.user:", req.user);
    console.log("req.body:", req.body);

    const data = {
        ...req.body,
        restaurant_id: req.user.restaurant_id
    };

    menuModel.addMenuItem(data, (err, result) => {

        if (err) {
            console.error("DB ERROR:", err);

            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Menu item added successfully."
        });

    });

};
// Update Menu Item
exports.updateMenuItem = (req, res) => {

    menuModel.updateMenuItem(
        req.params.id,
        req.body,
        (err, result) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            res.json({
                success: true,
                message: "Menu item updated successfully."
            });

        }
    );

};

// Delete Menu Item
exports.deleteMenuItem = (req, res) => {

    menuModel.deleteMenuItem(req.params.id, (err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Menu item deleted successfully."
        });

    });

};