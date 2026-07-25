const categoryModel = require("../models/categoryModel");

// Get all categories
exports.getAllCategories = (req, res) => {
    categoryModel.getAllCategories((err, results) => {
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

// Get category by ID
exports.getCategoryById = (req, res) => {
    categoryModel.getCategoryById(req.params.id, (err, results) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.json({
            success: true,
            data: results[0]
        });
    });
};

// Create category
exports.createCategory = (req, res) => {
    categoryModel.createCategory(req.body, (err, result) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Category created successfully",
            id: result.insertId
        });
    });
};

// Update category
exports.updateCategory = (req, res) => {
    categoryModel.updateCategory(req.params.id, req.body, (err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Category updated successfully"
        });
    });
};

// Delete category
exports.deleteCategory = (req, res) => {
    categoryModel.deleteCategory(req.params.id, (err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Category deleted successfully"
        });
    });
};