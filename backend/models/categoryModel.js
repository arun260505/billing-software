const db = require("../config/db");

// ===============================
// Get All Categories (tenant-scoped)
// ===============================
exports.getCategories = (restaurantId, callback) => {

    const sql = `
        SELECT
            id,
            restaurant_id,
            category_name,
            description,
            display_order,
            status,
            created_at
        FROM categories
        WHERE restaurant_id = ?
        ORDER BY display_order ASC, category_name ASC
    `;

    db.query(sql, [restaurantId], callback);

};

// ===============================
// Summary Cards (tenant-scoped)
// ===============================
exports.getSummary = (restaurantId, callback) => {

    const sql = `
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status='Inactive' THEN 1 ELSE 0 END) AS inactive
        FROM categories
        WHERE restaurant_id = ?
    `;

    db.query(sql, [restaurantId], (err, results) => {

        if (err) return callback(err);

        callback(null, results[0]);

    });

};

// ===============================
// Add Category (restaurant_id from caller, not client)
// ===============================
exports.addCategory = (data, callback) => {

    // Duplicate-name check is scoped to the caller's restaurant.
    db.query(
        "SELECT id FROM categories WHERE category_name = ? AND restaurant_id = ?",
        [data.category_name, data.restaurant_id],
        (err, rows) => {

            if (err) return callback(err);

            if (rows.length > 0) {
                return callback(new Error("Category already exists."));
            }

            const sql = `
                INSERT INTO categories
                (
                    restaurant_id,
                    category_name,
                    description,
                    display_order,
                    status
                )
                VALUES
                (?, ?, ?, ?, ?)
            `;

            db.query(
                sql,
                [
                    data.restaurant_id,
                    data.category_name,
                    data.description,
                    data.display_order || 0,
                    data.status || "Active"
                ],
                callback
            );

        }
    );

};

// ===============================
// Update Category (tenant-scoped)
// ===============================
exports.updateCategory = (id, restaurantId, data, callback) => {

    const sql = `
        UPDATE categories
        SET
            category_name = ?,
            description = ?,
            display_order = ?,
            status = ?
        WHERE id = ? AND restaurant_id = ?
    `;

    db.query(
        sql,
        [
            data.category_name,
            data.description,
            data.display_order,
            data.status,
            id,
            restaurantId
        ],
        callback
    );

};

// ===============================
// Delete Category (tenant-scoped)
// ===============================
exports.deleteCategory = (id, restaurantId, callback) => {

    db.query(
        "DELETE FROM categories WHERE id = ? AND restaurant_id = ?",
        [id, restaurantId],
        callback
    );

};
