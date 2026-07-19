const db = require("../config/db");

const Table = {

    getAll(callback) {

        const sql = `
            SELECT *
            FROM restaurant_tables
            ORDER BY table_number ASC
        `;

        db.query(sql, callback);

    },

    getById(id, callback) {

        const sql = `
            SELECT *
            FROM restaurant_tables
            WHERE id = ?
        `;

        db.query(sql, [id], callback);

    },

    updateStatus(id, status, callback) {

        const sql = `
            UPDATE restaurant_tables
            SET status = ?
            WHERE id = ?
        `;

        db.query(sql, [status, id], callback);

    },

    findByOrder(orderId, callback) {

        const sql = `
            SELECT t.*
            FROM restaurant_tables t
            INNER JOIN orders o ON o.table_id = t.id
            WHERE o.id = ?
        `;

        db.query(sql, [orderId], callback);

    }

};

module.exports = Table;
