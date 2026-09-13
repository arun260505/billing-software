const settingsModel = require("../models/settingsModel");
const { success, error } = require("../utils/response");
const { validateRestaurant, validatePayments, validateSecurity } = require("../utils/validate");
const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

// ── 1. Restaurant Settings ─────────────────────────────────────

exports.getRestaurant = (req, res) => {
    const rid = req.user.restaurant_id;
    if (!rid) return error(res, "Restaurant context required.", 400);

    settingsModel.getRestaurantSettings(rid, (err, data) => {
        if (err) return error(res, err.message, 500);
        return success(res, "Restaurant settings retrieved.", data);
    });
};

exports.saveRestaurant = (req, res) => {
    const rid = req.user.restaurant_id;
    if (!rid) return error(res, "Restaurant context required.", 400);

    const errors = validateRestaurant(req.body);
    if (errors.length > 0) return error(res, errors.join(" "), 400);

    settingsModel.saveRestaurantSettings(rid, req.body, (err) => {
        if (err) return error(res, err.message, 500);
        settingsModel.getRestaurantSettings(rid, (fetchErr, data) => {
            if (fetchErr) return error(res, fetchErr.message, 500);
            return success(res, "Restaurant settings saved.", data);
        });
    });
};

// ── 1b. Discount rule (owner only) ─────────────────────────────
// PUT /api/settings/discounts { discount_enabled, discount_max_percent, discount_max_amount }
// Read back through GET /api/settings/restaurant, which the front desk also uses.

exports.saveDiscounts = (req, res) => {
    const rid = req.user.restaurant_id;
    if (!rid) return error(res, "Restaurant context required.", 400);

    const enabled = req.body.discount_enabled === true || Number(req.body.discount_enabled) === 1;
    const pct = Number(req.body.discount_max_percent || 0);
    const amt = Number(req.body.discount_max_amount || 0);

    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return error(res, "Maximum percentage must be between 0 and 100.", 400);
    }
    if (!Number.isFinite(amt) || amt < 0 || amt > 10000000) {
        return error(res, "Maximum amount must be 0 or more.", 400);
    }
    if (enabled && pct === 0 && amt === 0) {
        return error(res, "Set a maximum percentage, a maximum amount, or both.", 400);
    }

    settingsModel.saveDiscountSettings(rid, {
        discount_enabled: enabled,
        discount_max_percent: Math.round(pct * 100) / 100,
        discount_max_amount: Math.round(amt * 100) / 100
    }, (err) => {
        if (err) return error(res, err.message, 500);
        settingsModel.getRestaurantSettings(rid, (fetchErr, data) => {
            if (fetchErr) return error(res, fetchErr.message, 500);
            return success(res, "Discount settings saved.", data);
        });
    });
};

// ── 1c. Salon bills: printer or not + WhatsApp message (owner only) ──
// PUT /api/settings/whatsapp { bill_delivery, whatsapp_template }
// bill_delivery: "printer_optional" | "no_printer". An empty template means the
// default message (stored as NULL). Read back through GET /api/settings/restaurant.

const BILL_DELIVERY_VALUES = ["printer_optional", "no_printer"];
const WHATSAPP_TEMPLATE_MAX = 2000;

exports.saveWhatsApp = (req, res) => {
    const rid = req.user.restaurant_id;
    if (!rid) return error(res, "Restaurant context required.", 400);

    const delivery = req.body.bill_delivery;
    if (!BILL_DELIVERY_VALUES.includes(delivery)) {
        return error(res, "Choose Printer optional or No printer.", 400);
    }

    const raw = req.body.whatsapp_template;
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
        return error(res, "The WhatsApp message must be text.", 400);
    }
    const template = String(raw || "").replace(/\r\n?/g, "\n");
    if (template.length > WHATSAPP_TEMPLATE_MAX) {
        return error(res, `The WhatsApp message can be at most ${WHATSAPP_TEMPLATE_MAX} characters.`, 400);
    }

    // The salon-wide default for which WhatsApp bills open in (a till can still
    // override it on its own POS). Anything but "app" is Web.
    const whatsapp_via = req.body.whatsapp_via === "app" ? "app" : "web";

    settingsModel.saveWhatsAppSettings(rid, {
        bill_delivery: delivery,
        whatsapp_template: template.trim() ? template : null,
        whatsapp_via
    }, (err) => {
        if (err) return error(res, err.message, 500);
        settingsModel.getRestaurantSettings(rid, (fetchErr, data) => {
            if (fetchErr) return error(res, fetchErr.message, 500);
            return success(res, "Bill & WhatsApp settings saved.", data);
        });
    });
};

// ── 2. Payment Settings ────────────────────────────────────────

exports.getPayments = (req, res) => {
    const rid = req.user.restaurant_id;
    if (!rid) return error(res, "Restaurant context required.", 400);

    settingsModel.getPaymentSettings(rid, (err, data) => {
        if (err) return error(res, err.message, 500);
        return success(res, "Payment settings retrieved.", data);
    });
};

exports.savePayments = (req, res) => {
    const rid = req.user.restaurant_id;
    if (!rid) return error(res, "Restaurant context required.", 400);

    const errors = validatePayments(req.body);
    if (errors.length > 0) return error(res, errors.join(" "), 400);

    settingsModel.savePaymentSettings(rid, req.body, (err) => {
        if (err) return error(res, err.message, 500);
        settingsModel.getPaymentSettings(rid, (fetchErr, data) => {
            if (fetchErr) return error(res, fetchErr.message, 500);
            return success(res, "Payment settings saved.", data);
        });
    });
};

// ── 3. Security Settings ───────────────────────────────────────

exports.getSecurity = (req, res) => {
    const rid = req.user.restaurant_id;
    if (!rid) return error(res, "Restaurant context required.", 400);

    settingsModel.getSecuritySettings(rid, (err, data) => {
        if (err) return error(res, err.message, 500);
        return success(res, "Security settings retrieved.", data);
    });
};

exports.saveSecurity = (req, res) => {
    const rid = req.user.restaurant_id;
    if (!rid) return error(res, "Restaurant context required.", 400);

    const errors = validateSecurity(req.body);
    if (errors.length > 0) return error(res, errors.join(" "), 400);

    settingsModel.saveSecuritySettings(rid, req.body, (err) => {
        if (err) return error(res, err.message, 500);
        settingsModel.getSecuritySettings(rid, (fetchErr, data) => {
            if (fetchErr) return error(res, fetchErr.message, 500);
            return success(res, "Security settings saved.", data);
        });
    });
};

// ── 4. Staff & Permissions ─────────────────────────────────────

exports.getRoles = (req, res) => {
    const rid = req.user.restaurant_id;
    if (!rid) return error(res, "Restaurant context required.", 400);

    settingsModel.getRoles(rid, (err, results) => {
        if (err) return error(res, err.message, 500);
        return success(res, "Roles retrieved.", results);
    });
};

exports.getPermissions = (_req, res) => {
    settingsModel.getPermissions((err, results) => {
        if (err) return error(res, err.message, 500);
        return success(res, "Permissions retrieved.", results);
    });
};

exports.getRolePermissions = (req, res) => {
    const rid = req.user.restaurant_id;
    if (!rid) return error(res, "Restaurant context required.", 400);

    settingsModel.getRolePermissions(req.params.roleId, (err, results) => {
        if (err) return error(res, err.message, 500);
        const ids = (results || []).map((r) => r.permission_id);
        return success(res, "Role permissions retrieved.", { role_id: Number(req.params.roleId), permission_ids: ids });
    });
};

exports.saveRolePermissions = (req, res) => {
    const rid = req.user.restaurant_id;
    if (!rid) return error(res, "Restaurant context required.", 400);

    const { roleId } = req.params;
    const permissionIds = Array.isArray(req.body.permission_ids) ? req.body.permission_ids.map(Number).filter(Boolean) : [];

    settingsModel.saveRolePermissions(roleId, permissionIds, (err) => {
        if (err) return error(res, err.message, 500);
        return success(res, "Permissions saved.");
    });
};

// ── 5. Change Password ─────────────────────────────────────────

exports.changePassword = (req, res) => {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
        return error(res, "Current password and new password are required.", 400);
    }
    if (new_password.length < 6) {
        return error(res, "New password must be at least 6 characters.", 400);
    }

    settingsModel.getUserById(userId, (err, user) => {
        if (err) return error(res, err.message, 500);
        if (!user) return error(res, "User not found.", 404);

        bcrypt.compare(current_password, user.password, (err, match) => {
            if (err) return error(res, err.message, 500);
            if (!match) return error(res, "Current password is incorrect.", 400);

            bcrypt.hash(new_password, SALT_ROUNDS, (err, hash) => {
                if (err) return error(res, err.message, 500);

                settingsModel.changePassword(userId, hash, (err2) => {
                    if (err2) return error(res, err2.message, 500);
                    return success(res, "Password changed successfully.");
                });
            });
        });
    });
};
