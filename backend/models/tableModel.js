const db = require("../config/db");

// Get all tables
const getAllTables = (callback) => {
    const sql = `
        SELECT *
        FROM dining_tables
        ORDER BY table_name ASC
    `;

    db.query(sql, callback);
};

// Get table by ID
const getTableById = (id, callback) => {
    db.query(
        "SELECT * FROM dining_tables WHERE id = ?",
        [id],
        callback
    );
};

// Create table
const createTable = (table, callback) => {

    const sql = `
        INSERT INTO dining_tables
        (
            restaurant_id,
            table_name,
            capacity,
            location,
            status,
            qr_code
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        table.restaurant_id,
        table.table_name,
        table.capacity,
        table.location,
        table.status,
        table.qr_code
    ], callback);
};

// Update table
const updateTable = (id, table, callback) => {

    const sql = `
        UPDATE dining_tables
        SET
            table_name=?,
            capacity=?,
            location=?,
            status=?,
            qr_code=?
        WHERE id=?
    `;

    db.query(sql, [
        table.table_name,
        table.capacity,
        table.location,
        table.status,
        table.qr_code,
        id
    ], callback);
};

// Delete table
const deleteTable = (id, callback) => {

    db.query(
        "DELETE FROM dining_tables WHERE id=?",
        [id],
        callback
    );

};

module.exports = {
    getAllTables,
    getTableById,
    createTable,
    updateTable,
    deleteTable
};