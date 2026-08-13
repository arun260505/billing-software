const db = require("../config/db");

const Menu = {

    // Get all categories
    getCategories(callback) {

        const sql = `
            SELECT id, category_name, status
            FROM categories
            WHERE status = 'Active'
            ORDER BY category_name ASC
        `;

        db.query(sql, callback);
    },

    // Get all menu items
    getAllItems(callback) {

        const sql = `
            SELECT
                m.id,
                m.item_name,
                m.price,
                m.gst,
                m.available AS available_quantity,
                c.category_name
            FROM menu_items m
            INNER JOIN categories c
                ON m.category_id = c.id
            ORDER BY m.item_name ASC
        `;

        db.query(sql, callback);
    },

    // Get items by category
    getItemsByCategory(categoryId, callback) {

        const sql = `
            SELECT
                m.id,
                m.item_name,
                m.price,
                m.gst,
                m.available AS available_quantity,
                c.category_name
            FROM menu_items m
            INNER JOIN categories c
                ON m.category_id = c.id
            WHERE m.category_id = ?
            ORDER BY m.item_name ASC
        `;

        db.query(sql, [categoryId], callback);
    }

};

module.exports = Menu;