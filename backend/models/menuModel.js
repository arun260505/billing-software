const db = require("../config/db");

// Get All Menu Items
exports.getAllMenuItems = (callback) => {

    const sql = `
        SELECT
            m.*,
            c.category_name
        FROM menu_items m
        JOIN categories c
            ON m.category_id = c.id
        ORDER BY m.display_order ASC, m.item_name ASC
    `;

    db.query(sql, callback);

};

exports.getSummary = (callback) => {

    const sql = `
        SELECT
            COUNT(*) AS totalItems,
            COALESCE(SUM(available = 1), 0) AS availableItems,
            COALESCE(SUM(is_best_seller = 1), 0) AS bestSellerItems,
            COALESCE(SUM(is_today_special = 1), 0) AS todaySpecialItems
        FROM menu_items
    `;

    db.query(sql, callback);

};

// Add Menu Item
exports.addMenuItem = (data, callback) => {

    const sql = `
        INSERT INTO menu_items
        (
            restaurant_id,
            category_id,
            item_name,
            item_code,
            price,
            gst,
            kitchen_section,
            food_type,
            available,
            description,
            preparation_time,
            display_order,
            is_today_special,
            is_best_seller,
            is_new_item,
            is_seasonal,
            image
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [

        data.restaurant_id,
        data.category_id,
        data.item_name,
        data.item_code,
        data.price,
        data.gst,
        data.kitchen_section,
        data.food_type,
        data.available,
        data.description,
        data.preparation_time,
        data.display_order,
        data.is_today_special,
        data.is_best_seller,
        data.is_new_item,
        data.is_seasonal,
        data.image

    ], callback);

};

// Update Menu Item
exports.updateMenuItem = (id, data, callback) => {

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
            available=?,
            description=?,
            preparation_time=?,
            display_order=?,
            is_today_special=?,
            is_best_seller=?,
            is_new_item=?,
            is_seasonal=?,
            image=?
        WHERE id=?
    `;

    db.query(sql, [

        data.category_id,
        data.item_name,
        data.item_code,
        data.price,
        data.gst,
        data.kitchen_section,
        data.food_type,
        data.available,
        data.description,
        data.preparation_time,
        data.display_order,
        data.is_today_special,
        data.is_best_seller,
        data.is_new_item,
        data.is_seasonal,
        data.image,
        id

    ], callback);

};

// Delete Menu Item
exports.deleteMenuItem = (id, callback) => {

    db.query(
        "DELETE FROM menu_items WHERE id=?",
        [id],
        callback
    );

};