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
            qr_code,
            current_bill,
            reservation_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            1,                              // Default restaurant
            table.table_name,
            table.capacity,
            table.location || "",
            table.status,
            null,                           // QR code will be generated later
            0,                              // Current bill
            null                            // Reservation time
        ],
        callback
    );

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
// Dashboard Statistics
const getDashboardStats = (callback) => {

    const sql = `
        SELECT
            COUNT(*) AS totalTables,
            SUM(status='Available') AS available,
            SUM(status='Occupied') AS occupied,
            SUM(status='Reserved') AS reserved,
            SUM(status='Billing') AS billing,
            SUM(status='Cleaning') AS cleaning
        FROM dining_tables
    `;

    db.query(sql, callback);

};

module.exports = {
    getAllTables,
    getTableById,
    createTable,
    updateTable,
    deleteTable,
    getDashboardStats
};