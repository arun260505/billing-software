const db = require("../config/db");

// Get all menu items
const getAllMenuItems = (callback) => {
    const sql = `
        SELECT
            m.*,
            c.category_name
        FROM menu_items m
        INNER JOIN categories c
            ON m.category_id = c.id
        WHERE m.deleted_at IS NULL
        ORDER BY m.display_order ASC, m.item_name ASC
    `;

    db.query(sql, callback);
};

// Get menu item by ID
const getMenuItemById = (id, callback) => {
    db.query(
        "SELECT * FROM menu_items WHERE id = ? AND deleted_at IS NULL",
        [id],
        callback
    );
};

// Create menu item
const createMenuItem = (item, callback) => {

    const sql = `
        INSERT INTO menu_items (
            restaurant_id,
            category_id,
            item_name,
            item_code,
            price,
            gst,
            kitchen_section,
            food_type,
            image,
            is_today_special,
            is_best_seller,
            is_new_item,
            is_seasonal,
            available,
            description,
            preparation_time,
            display_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        item.restaurant_id,
        item.category_id,
        item.item_name,
        item.item_code,
        item.price,
        item.gst,
        item.kitchen_section,
        item.food_type,
        item.image,
        item.is_today_special,
        item.is_best_seller,
        item.is_new_item,
        item.is_seasonal,
        item.available,
        item.description,
        item.preparation_time,
        item.display_order
    ], callback);
};

// Update menu item
const updateMenuItem = (id, item, callback) => {

    const sql = `
        UPDATE menu_items
        SET
            category_id=?,
            item_name=?,
            item_code=?,
            price=?,
            gst=?,
            kitchen_section=?,
            food_type=?,
            image=?,
            is_today_special=?,
            is_best_seller=?,
            is_new_item=?,
            is_seasonal=?,
            available=?,
            description=?,
            preparation_time=?,
            display_order=?
        WHERE id=?
    `;

    db.query(sql, [
        item.category_id,
        item.item_name,
        item.item_code,
        item.price,
        item.gst,
        item.kitchen_section,
        item.food_type,
        item.image,
        item.is_today_special,
        item.is_best_seller,
        item.is_new_item,
        item.is_seasonal,
        item.available,
        item.description,
        item.preparation_time,
        item.display_order,
        id
    ], callback);
};

// Delete menu item
const deleteMenuItem = (id, callback) => {
    // Soft delete so the removal syncs to the cloud.
    db.query(
        "UPDATE menu_items SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
        [id],
        callback
    );
};

module.exports = {
    getAllMenuItems,
    getMenuItemById,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem
};