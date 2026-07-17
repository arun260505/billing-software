const Menu = require("../models/Menu");

// GET /api/menu/categories
exports.getCategories = (req, res) => {

    Menu.getCategories((err, results) => {

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

// GET /api/menu/items
exports.getAllItems = (req, res) => {

    Menu.getAllItems((err, results) => {

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

// GET /api/menu/items/category/:id
exports.getItemsByCategory = (req, res) => {

    const categoryId = req.params.id;

    Menu.getItemsByCategory(categoryId, (err, results) => {

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