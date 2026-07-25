const db = require("../config/db");

// Get Settings
const getSettings = (restaurantId, callback) => {

    const sql = `
        SELECT *
        FROM settings
        WHERE restaurant_id = ?
    `;

    db.query(sql, [restaurantId], callback);

};

// Create Settings
const createSettings = (data, callback) => {

    const sql = `
        INSERT INTO settings
        (
            restaurant_id,
            restaurant_name,
            logo,
            address,
            phone,
            email,
            gst_number,
            currency,
            currency_symbol,
            tax_percentage,
            service_charge,
            invoice_footer
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        data.restaurant_id,
        data.restaurant_name,
        data.logo,
        data.address,
        data.phone,
        data.email,
        data.gst_number,
        data.currency,
        data.currency_symbol,
        data.tax_percentage,
        data.service_charge,
        data.invoice_footer
    ], callback);

};

// Update Settings
const updateSettings = (restaurantId, data, callback) => {

    const sql = `
        UPDATE settings
        SET
            restaurant_name = ?,
            logo = ?,
            address = ?,
            phone = ?,
            email = ?,
            gst_number = ?,
            currency = ?,
            currency_symbol = ?,
            tax_percentage = ?,
            service_charge = ?,
            invoice_footer = ?
        WHERE restaurant_id = ?
    `;

    db.query(sql, [
        data.restaurant_name,
        data.logo,
        data.address,
        data.phone,
        data.email,
        data.gst_number,
        data.currency,
        data.currency_symbol,
        data.tax_percentage,
        data.service_charge,
        data.invoice_footer,
        restaurantId
    ], callback);

};
// Get Roles
const getRoles = (restaurantId, callback) => {

    db.query(
        "SELECT * FROM roles WHERE restaurant_id=? ORDER BY role_name",
        [restaurantId],
        callback
    );

};

// Create Role
const createRole = (data, callback) => {

    db.query(
        "INSERT INTO roles (restaurant_id, role_name, description) VALUES (?,?,?)",
        [
            data.restaurant_id,
            data.role_name,
            data.description
        ],
        callback
    );

};

// Get Permissions
const getPermissions = (callback) => {

    db.query(
        "SELECT * FROM permissions ORDER BY module_name, permission_name",
        callback
    );

};

// Assign Permissions
const assignPermissions = (roleId, permissions, callback) => {

    db.query(
        "DELETE FROM role_permissions WHERE role_id=?",
        [roleId],
        (err) => {

            if (err) return callback(err);

            if (permissions.length === 0)
                return callback(null);

            const values = permissions.map(permissionId => [
                roleId,
                permissionId
            ]);

            db.query(
                "INSERT INTO role_permissions (role_id, permission_id) VALUES ?",
                [values],
                callback
            );

        }
    );

};
// Save Activity Log
const createActivityLog = (data, callback) => {

    const sql = `
        INSERT INTO activity_logs
        (
            restaurant_id,
            user_id,
            module,
            action,
            description
        )
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        data.restaurant_id,
        data.user_id,
        data.module,
        data.action,
        data.description
    ], callback);

};

// Get Activity Logs
const getActivityLogs = (restaurantId, callback) => {

    const sql = `
        SELECT
            al.id,
            u.full_name,
            al.module,
            al.action,
            al.description,
            al.created_at
        FROM activity_logs al
        INNER JOIN users u
            ON al.user_id = u.id
        WHERE al.restaurant_id = ?
        ORDER BY al.created_at DESC
    `;

    db.query(sql, [restaurantId], callback);

};

module.exports = {

    getSettings,
    createSettings,
    updateSettings,

    createActivityLog,
    getActivityLogs

};