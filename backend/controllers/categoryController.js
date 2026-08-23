const categoryModel = require("../models/categoryModel");
const { success, error } = require("../utils/response");

const normalizeTiming = (body = {}) => {
    const startTime = body.start_time || null;
    const endTime = body.end_time || null;

    if ((startTime && !endTime) || (!startTime && endTime)) {
        return {
            message: "Please set both start time and end time for category timing."
        };
    }

    return {
        data: {
            ...body,
            start_time: startTime,
            end_time: endTime
        }
    };
};

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

    const normalized = normalizeTiming(req.body);

    if (normalized.message) {
        return error(res, normalized.message, 400);
    }

    const data = {
        ...normalized.data,
        restaurant_id: req.user.restaurant_id
    };

    categoryModel.addCategory(data, (err) => {

        if (err) return error(res, err.message, 400);

        return success(res, "Category created successfully.", null, 201);

    });

};

// Update Category
exports.updateCategory = (req, res) => {

    const normalized = normalizeTiming(req.body);

    if (normalized.message) {
        return error(res, normalized.message, 400);
    }

    categoryModel.updateCategory(
        req.params.id,
        req.user.restaurant_id,
        normalized.data,
        (err) => {

            if (err) return error(res, err.message, 500);

            return success(res, "Category updated successfully.");

        }
    );

};

// Update Category Timing only (used by the Menu page inline editor)
exports.updateCategoryTiming = (req, res) => {

    const startTime = req.body.start_time || null;
    const endTime = req.body.end_time || null;

    if ((startTime && !endTime) || (!startTime && endTime)) {
        return error(res, "Please set both start time and end time, or clear both.", 400);
    }

    categoryModel.updateCategoryTiming(
        req.params.id,
        req.user.restaurant_id,
        startTime,
        endTime,
        (err) => {

            if (err) return error(res, err.message, 500);

            return success(res, "Category timing updated successfully.");

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
