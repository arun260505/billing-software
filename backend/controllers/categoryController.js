const categoryModel = require("../models/categoryModel");
const { success, error } = require("../utils/response");

// Get All Categories
exports.getCategories = (req, res) => {

    categoryModel.getCategories(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Categories fetched.", results);

    });

};

// Summary
exports.getSummary = (req, res) => {

    categoryModel.getSummary(req.user.restaurant_id, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Category summary fetched.", result);

    });

};

// Add Category
exports.addCategory = (req, res) => {

    const data = {
        ...req.body,
        restaurant_id: req.user.restaurant_id
    };

    categoryModel.addCategory(data, (err) => {

        if (err) return error(res, err.message, 400);

        return success(res, "Category created successfully.", null, 201);

    });

};

// Update Category
exports.updateCategory = (req, res) => {

    categoryModel.updateCategory(
        req.params.id,
        req.user.restaurant_id,
        req.body,
        (err) => {

            if (err) return error(res, err.message, 500);

            return success(res, "Category updated successfully.");

        }
    );

};

// Delete Category
exports.deleteCategory = (req, res) => {

    categoryModel.deleteCategory(
        req.params.id,
        req.user.restaurant_id,
        (err) => {

            if (err) return error(res, err.message, 500);

            return success(res, "Category deleted successfully.");

        }
    );

};
