const chargeModel = require("../models/chargeModel");
const { normalizeRole, ROLES } = require("../utils/billing");
const { invalidate: invalidateBillingCharges } = require("../utils/billingCharges");
const { success, error } = require("../utils/response");

/*
| GST and the service charge are charge rows like any other — a row whose
| charge_role is 'Tax' or 'Service' is totalled into orders.tax /
| orders.service_charge so it stays separable for GST reporting, and one flagged
| auto_apply lands on every bill without the cashier picking it.
|
| Every write here invalidates the biller's cache, so switching GST off (or
| changing its rate) takes effect on the very next bill instead of up to 30
| seconds later.
*/

// Only a percentage or a fixed amount can be a tax or service charge: the
// per-item / per-person / per-hour types have no meaning as a tax and would
// quietly bill the wrong figure.
const ROLE_TYPES = ["Fixed", "Percentage"];

const chargeFromBody = (body) => {
    const charge_role = normalizeRole(body.charge_role);
    return {
        charge_name: (body.charge_name || "").trim(),
        description: (body.description || "").trim() || null,
        charge_type: (body.charge_type || "").trim(),
        charge_role,
        amount: Number(body.amount) || 0,
        // A tax or service charge is meaningless as an opt-in chip the cashier
        // may forget to tap, so those always apply automatically.
        auto_apply: charge_role === ROLES.CHARGE ? (body.auto_apply ? 1 : 0) : 1,
        applies_dinein: body.applies_dinein ? 1 : 0,
        applies_takeaway: body.applies_takeaway ? 1 : 0,
        applies_delivery: body.applies_delivery ? 1 : 0,
        apply_tax: body.apply_tax ? 1 : 0,
        status: body.status || "Active"
    };
};

const validateCharge = (charge) => {
    if (!charge.charge_name || !charge.charge_type || !Number.isFinite(charge.amount)) {
        return "Charge name, type and amount are required.";
    }
    if (charge.charge_role !== ROLES.CHARGE && !ROLE_TYPES.includes(charge.charge_type)) {
        return `A ${charge.charge_role.toLowerCase()} charge must be a percentage or a fixed amount.`;
    }
    return null;
};

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
            delivery_count: Number(row.delivery_count) || 0,
            tax_count: Number(row.tax_count) || 0,
            service_count: Number(row.service_count) || 0,
            auto_count: Number(row.auto_count) || 0
        });

    });

};

// Create Charge
exports.createCharge = (req, res) => {

    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Unauthorized: restaurant_id missing from token.", 401);
    }

    const charge = { restaurant_id: restaurantId, ...chargeFromBody(req.body) };

    const invalid = validateCharge(charge);
    if (invalid) return error(res, invalid, 400);

    chargeModel.createCharge(charge, (err, result) => {

        if (err) {
            console.error("createCharge DB error:", err.message);
            return error(res, err.message, 500);
        }

        invalidateBillingCharges(restaurantId);

        return success(res, "Charge created successfully", { id: result.insertId }, 201);

    });

};

// Update Charge
exports.updateCharge = (req, res) => {

    const restaurantId = req.user.restaurant_id;

    if (!restaurantId) {
        return error(res, "Unauthorized: restaurant_id missing from token.", 401);
    }

    const charge = chargeFromBody(req.body);

    const invalid = validateCharge(charge);
    if (invalid) return error(res, invalid, 400);

    chargeModel.updateCharge(req.params.id, restaurantId, charge, (err, result) => {

        if (err) {
            console.error("updateCharge DB error:", err.message);
            return error(res, err.message, 500);
        }

        if (result.affectedRows === 0) {
            return error(res, "Charge not found.", 404);
        }

        invalidateBillingCharges(restaurantId);

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

        invalidateBillingCharges(restaurantId);

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
            charge_role: original.charge_role,
            amount: original.amount,
            auto_apply: original.auto_apply ? 1 : 0,
            applies_dinein: original.applies_dinein ? 1 : 0,
            applies_takeaway: original.applies_takeaway ? 1 : 0,
            applies_delivery: original.applies_delivery ? 1 : 0,
            apply_tax: original.apply_tax ? 1 : 0,
            // Inactive on purpose: a duplicated GST row that billed immediately
            // would double the tax on the next bill.
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
