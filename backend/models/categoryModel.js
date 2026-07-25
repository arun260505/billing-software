const db = require("../config/db");

// Get all categories
const getAllCategories = (callback) => {
    const sql = `
        SELECT *
        FROM categories
        ORDER BY display_order ASC, category_name ASC
    `;

    db.query(sql, callback);
};

// Get category by ID
const getCategoryById = (id, callback) => {
    db.query(
        "SELECT * FROM categories WHERE id = ?",
        [id],
        callback
    );
};

// Create category
const createCategory = (category, callback) => {
    const sql = `
        INSERT INTO categories
        (
            restaurant_id,
            category_name,
            description,
            display_order,
            status
        )
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        category.restaurant_id,
        category.category_name,
        category.description,
        category.display_order,
        category.status
    ], callback);
};

// Update category
const updateCategory = (id, category, callback) => {
    const sql = `
        UPDATE categories
        SET
            category_name = ?,
            description = ?,
            display_order = ?,
            status = ?
        WHERE id = ?
    `;

    db.query(sql, [
        category.category_name,
        category.description,
        category.display_order,
        category.status,
        id
    ], callback);
};

// Delete category
const deleteCategory = (id, callback) => {
    db.query(
        "DELETE FROM categories WHERE id = ?",
        [id],
        callback
    );
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
};