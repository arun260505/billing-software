const db = require("../config/db");

// ===============================
// Get All Categories
// ===============================
exports.getCategories = (callback) => {

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
        ORDER BY display_order ASC, category_name ASC
    `;

    db.query(sql, callback);

};

// ===============================
// Summary Cards
// ===============================
exports.getSummary = (callback) => {

    const sql = `
        SELECT

            COUNT(*) AS total,

            SUM(
                CASE
                    WHEN status='Active'
                    THEN 1
                    ELSE 0
                END
            ) AS active,

            SUM(
                CASE
                    WHEN status='Inactive'
                    THEN 1
                    ELSE 0
                END
            ) AS inactive

        FROM categories
    `;

    db.query(sql, (err, results) => {

        if (err) {
            return callback(err);
        }

        callback(null, results[0]);

    });

};

// ===============================
// Add Category
// ===============================
exports.addCategory = (data, callback) => {

    db.query(

        "SELECT id FROM categories WHERE category_name=?",

        [data.category_name],

        (err, rows) => {

            if (err) {
                return callback(err);
            }

            if (rows.length > 0) {

                return callback(
                    new Error("Category already exists.")
                );

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
    2,
    data.category_name,
    data.description,
    data.display_order || 0,
    data.status || "Active"
]
                ,

                callback

            );

        }

    );

};

// ===============================
// Update Category
// ===============================
exports.updateCategory = (id, data, callback) => {

    const sql = `
        UPDATE categories

        SET

            category_name=?,

            description=?,

            display_order=?,

            status=?

        WHERE id=?
    `;

    db.query(

        sql,

        [

            data.category_name,

            data.description,

            data.display_order,

            data.status,

            id

        ],

        callback

    );

};

// ===============================
// Delete Category
// ===============================
exports.deleteCategory = (id, callback) => {

    db.query(

        "DELETE FROM categories WHERE id=?",

        [id],

        callback

    );

};