const db = require("../config/db");

// Get all tables (tenant-scoped) with served/total item counts for active orders
const getAllTables = (restaurantId, callback) => {
    const sql = `
        SELECT dt.*,
            (SELECT COUNT(*)
               FROM order_items oi
               INNER JOIN orders o ON oi.order_id = o.id
              WHERE o.table_id = dt.id AND o.restaurant_id = dt.restaurant_id
                AND o.order_status IN ('Pending','Preparing','Ready','Served')) AS total_items,
            (SELECT COUNT(*)
               FROM order_items oi
               INNER JOIN orders o ON oi.order_id = o.id
              WHERE o.table_id = dt.id AND o.restaurant_id = dt.restaurant_id
                AND o.order_status IN ('Pending','Preparing','Ready','Served')
                AND oi.served = 1) AS served_items
        FROM dining_tables dt
        WHERE dt.restaurant_id = ? AND dt.deleted_at IS NULL
        ORDER BY dt.table_name ASC
    `;

    db.query(sql, [restaurantId], callback);
};

// Get table by ID (tenant-scoped)
const getTableById = (id, restaurantId, callback) => {
    db.query(
        "SELECT * FROM dining_tables WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL",
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

    // Soft delete so the removal syncs to the cloud.
    db.query(
        "UPDATE dining_tables SET deleted_at = NOW() WHERE id=? AND restaurant_id=? AND deleted_at IS NULL",
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
        WHERE restaurant_id = ? AND deleted_at IS NULL
    `;

    db.query(sql, [restaurantId], callback);

};

// Update only a table's status (tenant-scoped) — used by the waiter board.
const updateStatus = (id, restaurantId, status, callback) => {

    db.query(
        "UPDATE dining_tables SET status = ? WHERE id = ? AND restaurant_id = ?",
        [status, id, restaurantId],
        callback
    );

};

module.exports = {
    getAllTables,
    getTableById,
    createTable,
    updateTable,
    deleteTable,
    getDashboardStats,
    updateStatus
};
