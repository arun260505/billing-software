const db = require("../config/db");

const getAllCharges = (restaurantId, callback) => {
    const sql = "SELECT * FROM charges WHERE restaurant_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC";
    db.query(sql, [restaurantId], callback);
};

const getChargeById = (id, restaurantId, callback) => {
    const sql = "SELECT * FROM charges WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL";
    db.query(sql, [id, restaurantId], callback);
};

const createCharge = (charge, callback) => {
    const sql = `INSERT INTO charges
        (restaurant_id, charge_name, description, charge_type, amount,
         applies_dinein, applies_takeaway, applies_delivery, apply_tax, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [
        charge.restaurant_id,
        charge.charge_name,
        charge.description || null,
        charge.charge_type,
        charge.amount,
        charge.applies_dinein ? 1 : 0,
        charge.applies_takeaway ? 1 : 0,
        charge.applies_delivery ? 1 : 0,
        charge.apply_tax ? 1 : 0,
        charge.status || "Active"
    ], callback);
};

const updateCharge = (id, restaurantId, charge, callback) => {
    const sql = `UPDATE charges SET
        charge_name=?, description=?, charge_type=?, amount=?,
        applies_dinein=?, applies_takeaway=?, applies_delivery=?,
        apply_tax=?, status=?
        WHERE id=? AND restaurant_id=?`;
    db.query(sql, [
        charge.charge_name,
        charge.description || null,
        charge.charge_type,
        charge.amount,
        charge.applies_dinein ? 1 : 0,
        charge.applies_takeaway ? 1 : 0,
        charge.applies_delivery ? 1 : 0,
        charge.apply_tax ? 1 : 0,
        charge.status || "Active",
        id,
        restaurantId
    ], callback);
};

const deleteCharge = (id, restaurantId, callback) => {
    // Soft delete so the removal syncs to the cloud.
    db.query("UPDATE charges SET deleted_at = NOW() WHERE id=? AND restaurant_id=? AND deleted_at IS NULL", [id, restaurantId], callback);
};

const getChargeSummary = (restaurantId, callback) => {
    const sql = `
        SELECT
            COUNT(*) AS total,
            SUM(status = 'Active') AS active,
            SUM(status = 'Inactive') AS inactive,
            SUM(applies_dinein = 1) AS dinein_count,
            SUM(applies_takeaway = 1) AS takeaway_count,
            SUM(applies_delivery = 1) AS delivery_count
        FROM charges WHERE restaurant_id = ? AND deleted_at IS NULL
    `;
    db.query(sql, [restaurantId], callback);
};

module.exports = {
    getAllCharges,
    getChargeById,
    createCharge,
    updateCharge,
    deleteCharge,
    getChargeSummary
};
