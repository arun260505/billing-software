const db = require("../config/db");

// Get all tables (tenant-scoped)
const getAllTables = (restaurantId, callback) => {
    const sql = `
        SELECT *
        FROM dining_tables
        WHERE restaurant_id = ?
        ORDER BY table_name ASC
    `;

    db.query(sql, [restaurantId], callback);
};

// Get table by ID (tenant-scoped)
const getTableById = (id, restaurantId, callback) => {
    db.query(
        "SELECT * FROM dining_tables WHERE id = ? AND restaurant_id = ?",
        [id, restaurantId],
        callback
    );
};

// Create table (restaurant_id from caller)
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
            table.restaurant_id,
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

// Update table (tenant-scoped)
const updateTable = (id, restaurantId, table, callback) => {

    const sql = `
        UPDATE dining_tables
        SET
            table_name=?,
            capacity=?,
            location=?,
            status=?,
            qr_code=?
        WHERE id=? AND restaurant_id=?
    `;

    db.query(sql, [
        table.table_name,
        table.capacity,
        table.location,
        table.status,
        table.qr_code,
        id,
        restaurantId
    ], callback);
};

// Delete table (tenant-scoped)
const deleteTable = (id, restaurantId, callback) => {

    db.query(
        "DELETE FROM dining_tables WHERE id=? AND restaurant_id=?",
        [id, restaurantId],
        callback
    );

};

// Dashboard Statistics (tenant-scoped)
const getDashboardStats = (restaurantId, callback) => {

    const sql = `
        SELECT
            COUNT(*) AS totalTables,
            SUM(status='Available') AS available,
            SUM(status='Occupied') AS occupied,
            SUM(status='Reserved') AS reserved,
            SUM(status='Billing') AS billing,
            SUM(status='Cleaning') AS cleaning
        FROM dining_tables
        WHERE restaurant_id = ?
    `;

    db.query(sql, [restaurantId], callback);

};

module.exports = {
    getAllTables,
    getTableById,
    createTable,
    updateTable,
    deleteTable,
    getDashboardStats
};
