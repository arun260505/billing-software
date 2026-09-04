const db = require("../config/db");

const KITCHEN_MODES = ["printer", "display", "both", "cashier_kds", "dual_printer", "single_printer"];
const CONNECTION_TYPES = ["USB", "Network", "Bluetooth"];

const validateRestaurant = (data) => {
    const errors = [];
    if (data.restaurant_name !== undefined && String(data.restaurant_name).length > 150) {
        errors.push("restaurant_name must be 150 characters or fewer.");
    }
    if (data.email !== undefined && data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) {
        errors.push("email must be a valid email address.");
    }
    if (data.phone !== undefined && data.phone && !/^[0-9+\-\s()]{0,20}$/.test(String(data.phone))) {
        errors.push("phone contains invalid characters.");
    }
    if (data.gst_number !== undefined && String(data.gst_number).length > 50) {
        errors.push("gst_number must be 50 characters or fewer.");
    }
    if (data.currency !== undefined && String(data.currency).length > 10) {
        errors.push("currency must be 10 characters or fewer.");
    }
    if (data.currency_symbol !== undefined && String(data.currency_symbol).length > 10) {
        errors.push("currency_symbol must be 10 characters or fewer.");
    }
    if (data.tax_percentage !== undefined) {
        const v = Number(data.tax_percentage);
        if (isNaN(v) || v < 0 || v > 100) errors.push("tax_percentage must be between 0 and 100.");
    }
    if (data.service_charge !== undefined) {
        const v = Number(data.service_charge);
        if (isNaN(v) || v < 0 || v > 100) errors.push("service_charge must be between 0 and 100.");
    }
    if (data.invoice_footer !== undefined && String(data.invoice_footer).length > 1000) {
        errors.push("invoice_footer must be 1000 characters or fewer.");
    }
    if (data.time_zone !== undefined && String(data.time_zone).length > 50) {
        errors.push("time_zone must be 50 characters or fewer.");
    }
    if (data.restaurant_status !== undefined && !["Open", "Closed"].includes(data.restaurant_status)) {
        errors.push("restaurant_status must be 'Open' or 'Closed'.");
    }
    return errors;
};

const validatePayments = (data) => {
    const errors = [];
    ["cash_enabled", "upi_enabled", "card_enabled", "other_enabled"].forEach((key) => {
        if (data[key] !== undefined && typeof data[key] !== "boolean" && data[key] !== 0 && data[key] !== 1) {
            errors.push(`${key} must be a boolean.`);
        }
    });
    if (data.upi_id !== undefined && data.upi_id && String(data.upi_id).length > 120) {
        errors.push("upi_id must be 120 characters or fewer.");
    }
    return errors;
};

const validateSecurity = (data) => {
    const errors = [];
    if (data.session_timeout_hours !== undefined) {
        const v = Number(data.session_timeout_hours);
        if (isNaN(v) || v < 1 || v > 24) errors.push("session_timeout_hours must be between 1 and 24.");
    }
    ["discount_approval", "refund_approval", "cancel_order_approval", "menu_price_change_approval"].forEach((key) => {
        if (data[key] !== undefined && typeof data[key] !== "boolean" && data[key] !== 0 && data[key] !== 1) {
            errors.push(`${key} must be a boolean.`);
        }
    });
    return errors;
};

module.exports = { validateRestaurant, validatePayments, validateSecurity, KITCHEN_MODES, CONNECTION_TYPES };
