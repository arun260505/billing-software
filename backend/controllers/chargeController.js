const chargeModel = require("../models/chargeModel");
const { success, error } = require("../utils/response");

// Get All Charges
exports.getCharges = (req, res) => {

    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Unauthorized: restaurant_id missing from token.", 401);
    }

    chargeModel.getAllCharges(restaurantId, (err, results) => {

        if (err) {
            console.error("getCharges error:", err.message);
            return error(res, err.message, 500);
        }

        return success(res, "Charges fetched successfully", results);

    });

};

// Summary
exports.getChargeSummary = (req, res) => {

    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Unauthorized: restaurant_id missing from token.", 401);
    }

    chargeModel.getChargeSummary(restaurantId, (err, results) => {

        if (err) {
            console.error("getChargeSummary error:", err.message);
            return error(res, err.message, 500);
        }

        const row = results[0] || {};

        return success(res, "Summary fetched", {
            total: Number(row.total) || 0,
            active: Number(row.active) || 0,
            inactive: Number(row.inactive) || 0,
            dinein_count: Number(row.dinein_count) || 0,
            takeaway_count: Number(row.takeaway_count) || 0,
            delivery_count: Number(row.delivery_count) || 0
        });

    });

};

// Create Charge
exports.createCharge = (req, res) => {

    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Unauthorized: restaurant_id missing from token.", 401);
    }

    const charge_name = (req.body.charge_name || "").trim();
    const charge_type = (req.body.charge_type || "").trim();
    const amount = req.body.amount;

    if (!charge_name || !charge_type || amount === undefined || amount === null || amount === "") {
        return error(res, "Charge name, type and amount are required.", 400);
    }

    const charge = {
        restaurant_id: restaurantId,
        charge_name: charge_name,
        description: (req.body.description || "").trim() || null,
        charge_type: charge_type,
        amount: Number(amount) || 0,
        applies_dinein: req.body.applies_dinein ? 1 : 0,
        applies_takeaway: req.body.applies_takeaway ? 1 : 0,
        applies_delivery: req.body.applies_delivery ? 1 : 0,
        apply_tax: req.body.apply_tax ? 1 : 0,
        status: req.body.status || "Active"
    };

    console.log("Creating charge:", charge);

    chargeModel.createCharge(charge, (err, result) => {

        if (err) {
            console.error("createCharge DB error:", err.message);
            return error(res, err.message, 500);
        }

        return success(res, "Charge created successfully", { id: result.insertId }, 201);

    });

};

// Update Charge
exports.updateCharge = (req, res) => {

    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Unauthorized: restaurant_id missing from token.", 401);
    }

    const charge_name = (req.body.charge_name || "").trim();
    const charge_type = (req.body.charge_type || "").trim();
    const amount = req.body.amount;

    if (!charge_name || !charge_type || amount === undefined || amount === null || amount === "") {
        return error(res, "Charge name, type and amount are required.", 400);
    }

    const charge = {
        charge_name: charge_name,
        description: (req.body.description || "").trim() || null,
        charge_type: charge_type,
        amount: Number(amount) || 0,
        applies_dinein: req.body.applies_dinein ? 1 : 0,
        applies_takeaway: req.body.applies_takeaway ? 1 : 0,
        applies_delivery: req.body.applies_delivery ? 1 : 0,
        apply_tax: req.body.apply_tax ? 1 : 0,
        status: req.body.status || "Active"
    };

    chargeModel.updateCharge(req.params.id, restaurantId, charge, (err, result) => {

        if (err) {
            console.error("updateCharge DB error:", err.message);
            return error(res, err.message, 500);
        }

        if (result.affectedRows === 0) {
            return error(res, "Charge not found.", 404);
        }

        return success(res, "Charge updated successfully");

    });

};

// Delete Charge
exports.deleteCharge = (req, res) => {

    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Unauthorized: restaurant_id missing from token.", 401);
    }

    chargeModel.deleteCharge(req.params.id, restaurantId, (err, result) => {

        if (err) {
            console.error("deleteCharge DB error:", err.message);
            return error(res, err.message, 500);
        }

        if (result.affectedRows === 0) {
            return error(res, "Charge not found.", 404);
        }

        return success(res, "Charge deleted successfully");

    });

};

// Duplicate Charge
exports.duplicateCharge = (req, res) => {

    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Unauthorized: restaurant_id missing from token.", 401);
    }

    chargeModel.getChargeById(req.params.id, restaurantId, (err, results) => {

        if (err) {
            console.error("duplicateCharge fetch error:", err.message);
            return error(res, err.message, 500);
        }

        if (!results.length) {
            return error(res, "Charge not found.", 404);
        }

        const original = results[0];

        const copy = {
            restaurant_id: restaurantId,
            charge_name: original.charge_name + " (Copy)",
            description: original.description,
            charge_type: original.charge_type,
            amount: original.amount,
            applies_dinein: original.applies_dinein ? 1 : 0,
            applies_takeaway: original.applies_takeaway ? 1 : 0,
            applies_delivery: original.applies_delivery ? 1 : 0,
            apply_tax: original.apply_tax ? 1 : 0,
            status: "Inactive"
        };

        chargeModel.createCharge(copy, (err2, result) => {

            if (err2) {
                console.error("duplicateCharge DB error:", err2.message);
                return error(res, err2.message, 500);
            }

            return success(res, "Charge duplicated", { id: result.insertId }, 201);

        });

    });

};
