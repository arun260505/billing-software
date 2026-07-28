const categoryModel = require("../models/categoryModel");

// ===============================
// Get All Categories
// ===============================
exports.getCategories = (req, res) => {

    categoryModel.getCategories((err, results) => {

        if (err) {

            return res.status(500).json({
                success: false,
                message: err.message
            });

        }

        res.json(results);

    });

};

// ===============================
// Summary
// ===============================
exports.getSummary = (req, res) => {

    categoryModel.getSummary((err, result) => {

        if (err) {

            return res.status(500).json({
                success: false,
                message: err.message
            });

        }

        res.json(result);

    });

};

// ===============================
// Add Category
// ===============================
exports.addCategory = (req, res) => {

    categoryModel.addCategory(req.body, (err) => {

        if (err) {

            return res.status(500).json({
                success: false,
                message: err.message
            });

        }

        res.json({
            success: true,
            message: "Category created successfully."
        });

    });

};

// ===============================
// Update Category
// ===============================
exports.updateCategory = (req, res) => {

    categoryModel.updateCategory(

        req.params.id,

        req.body,

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }

            res.json({
                success: true,
                message: "Category updated successfully."
            });

        }

    );

};

// ===============================
// Delete Category
// ===============================
exports.deleteCategory = (req, res) => {

    categoryModel.deleteCategory(

        req.params.id,

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }

            res.json({
                success: true,
                message: "Category deleted successfully."
            });

        }

    );

};