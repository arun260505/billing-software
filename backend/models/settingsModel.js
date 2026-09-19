const db = require("../config/db");
const bcrypt = require("bcryptjs");
const { readPolicy } = require("../utils/discountRules");

const DEFAULT_RESTAURANT = {
    restaurant_name: "",
    logo: null,
    address: "",
    phone: "",
    email: "",
    gst_number: "",
    currency: "INR",
    currency_symbol: "\u20B9",
    tax_percentage: 0,
    service_charge: 0,
    invoice_footer: "",
    time_zone: "Asia/Kolkata",
    opening_time: null,
    closing_time: null,
    restaurant_status: "Open",
    // 016: front-desk discounts, off until the owner allows them.
    discount_enabled: 0,
    discount_max_percent: 0,
    discount_max_amount: 0,
    // 018: salon bills — printer or not, and the owner's WhatsApp message
    // (NULL = the default message in src/utils/whatsappBill.js).
    bill_delivery: "printer_optional",
    whatsapp_template: null,
    // 019: salon-wide default for which WhatsApp bills open in ('web' | 'app').
    // A till can override this on its own POS.
    whatsapp_via: "web"
};

const DEFAULT_PAYMENT = {
    cash_enabled: 1,
    upi_enabled: 1,
    card_enabled: 1,
    other_enabled: 0,
    upi_id: null,
    // Which method is pre-selected at billing. Cash unless the owner changes it.
    default_method: "Cash"
};

// The methods the cashier screen can pre-select.
const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Wallet"];

const DEFAULT_SECURITY = {
    session_timeout_hours: 8,
    discount_approval: 0,
    refund_approval: 0,
    cancel_order_approval: 0,
    menu_price_change_approval: 0
};

// ── 1. Restaurant Settings ─────────────────────────────────────

const getRestaurantSettings = (restaurantId, callback) => {
    const sql = "SELECT * FROM settings WHERE restaurant_id = ?";
    db.query(sql, [restaurantId], (err, rows) => {
        if (err) return callback(err);
        const row = rows && rows.length > 0 ? rows[0] : null;
        const settings = row ? { ...DEFAULT_RESTAURANT, ...row } : { ...DEFAULT_RESTAURANT, restaurant_id: restaurantId };

        // shop_mobile / shop_name: the mobile and business name given when the
        // super admin created this business (restaurants). Read-only here; the
        // salon's WhatsApp bill signs off with the number, and the name stands in
        // when the Settings name is blank.
        db.query("SELECT mobile, restaurant_name FROM restaurants WHERE id = ? LIMIT 1", [restaurantId], (mErr, mRows) => {
            if (mErr) return callback(mErr);
            const biz = (mRows && mRows[0]) || {};
            settings.shop_mobile = biz.mobile || "";
            settings.shop_name = biz.restaurant_name || "";
            callback(null, settings);
        });
    });
};

const saveRestaurantSettings = (restaurantId, data, callback) => {
    const sql = `
        INSERT INTO settings
            (restaurant_id, restaurant_name, logo, address, phone, email,
             gst_number, currency, currency_symbol, tax_percentage, service_charge,
             invoice_footer, time_zone, opening_time, closing_time, restaurant_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            restaurant_name   = VALUES(restaurant_name),
            logo              = VALUES(logo),
            address           = VALUES(address),
            phone             = VALUES(phone),
            email             = VALUES(email),
            gst_number        = VALUES(gst_number),
            currency          = VALUES(currency),
            currency_symbol   = VALUES(currency_symbol),
            tax_percentage    = VALUES(tax_percentage),
            service_charge    = VALUES(service_charge),
            invoice_footer    = VALUES(invoice_footer),
            time_zone         = VALUES(time_zone),
            opening_time      = VALUES(opening_time),
            closing_time      = VALUES(closing_time),
            restaurant_status = VALUES(restaurant_status)
    `;
    const values = [
        restaurantId,
        (data.restaurant_name || "").slice(0, 150),
        data.logo || null,
        (data.address || "").slice(0, 1000),
        (data.phone || "").slice(0, 20),
        (data.email || "").slice(0, 100),
        (data.gst_number || "").slice(0, 50),
        (data.currency || "INR").slice(0, 10),
        (data.currency_symbol || "\u20B9").slice(0, 10),
        Number(data.tax_percentage) || 0,
        Number(data.service_charge) || 0,
        (data.invoice_footer || "").slice(0, 1000),
        (data.time_zone || "Asia/Kolkata").slice(0, 50),
        data.opening_time || null,
        data.closing_time || null,
        (data.restaurant_status || "Open").slice(0, 10)
    ];
    db.query(sql, values, callback);
};

// ── 1b. Discount rule ──────────────────────────────────────────
// Saved on its own so the main settings form (which rewrites every restaurant
// column) and this one never overwrite each other.

const saveDiscountSettings = (restaurantId, data, callback) => {
    const sql = `
        INSERT INTO settings
            (restaurant_id, discount_enabled, discount_max_percent, discount_max_amount)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            discount_enabled     = VALUES(discount_enabled),
            discount_max_percent = VALUES(discount_max_percent),
            discount_max_amount  = VALUES(discount_max_amount)
    `;
    db.query(sql, [
        restaurantId,
        data.discount_enabled ? 1 : 0,
        Number(data.discount_max_percent) || 0,
        Number(data.discount_max_amount) || 0
    ], callback);
};

// ── 1c. Salon bills: printer or not, and the WhatsApp message ──
// Own statement for the same reason as the discount rule.

const saveWhatsAppSettings = (restaurantId, data, callback) => {
    const sql = `
        INSERT INTO settings (restaurant_id, bill_delivery, whatsapp_template, whatsapp_via)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            bill_delivery     = VALUES(bill_delivery),
            whatsapp_template = VALUES(whatsapp_template),
            whatsapp_via      = VALUES(whatsapp_via)
    `;
    db.query(sql, [
        restaurantId,
        data.bill_delivery,
        data.whatsapp_template,
        data.whatsapp_via === "app" ? "app" : "web"
    ], callback);
};

// The rule a new bill is checked against (utils/discountRules.js).
const getDiscountPolicy = (restaurantId, callback) => {
    db.query(
        `SELECT discount_enabled, discount_max_percent, discount_max_amount
         FROM settings WHERE restaurant_id = ? LIMIT 1`,
        [restaurantId],
        (err, rows) => {
            if (err) return callback(err);
            callback(null, readPolicy(rows && rows[0]));
        }
    );
};

// ── 2. Payment Settings ────────────────────────────────────────

const getPaymentSettings = (restaurantId, callback) => {
    const sql = "SELECT * FROM payment_settings WHERE restaurant_id = ?";
    db.query(sql, [restaurantId], (err, rows) => {
        if (err) return callback(err);
        const row = rows && rows.length > 0 ? rows[0] : null;
        callback(null, row ? { ...DEFAULT_PAYMENT, ...row } : { ...DEFAULT_PAYMENT, restaurant_id: restaurantId });
    });
};

const savePaymentSettings = (restaurantId, data, callback) => {
    // Only a method that's actually enabled can be the default; fall back to Cash.
    const wanted = PAYMENT_METHODS.includes(data.default_method) ? data.default_method : "Cash";
    const enabledOf = { Cash: data.cash_enabled, UPI: data.upi_enabled, Card: data.card_enabled, Wallet: data.other_enabled };
    const defaultMethod = enabledOf[wanted] ? wanted : "Cash";

    const sql = `
        INSERT INTO payment_settings
            (restaurant_id, cash_enabled, upi_enabled, card_enabled, other_enabled, upi_id, default_method)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            cash_enabled = VALUES(cash_enabled),
            upi_enabled  = VALUES(upi_enabled),
            card_enabled = VALUES(card_enabled),
            other_enabled = VALUES(other_enabled),
            upi_id       = VALUES(upi_id),
            default_method = VALUES(default_method)
    `;
    const values = [
        restaurantId,
        data.cash_enabled ? 1 : 0,
        data.upi_enabled ? 1 : 0,
        data.card_enabled ? 1 : 0,
        data.other_enabled ? 1 : 0,
        (data.upi_id || "").slice(0, 120) || null,
        defaultMethod
    ];
    db.query(sql, values, callback);
};

// ── 3. Security Settings ───────────────────────────────────────

const getSecuritySettings = (restaurantId, callback) => {
    const sql = "SELECT * FROM security_settings WHERE restaurant_id = ?";
    db.query(sql, [restaurantId], (err, rows) => {
        if (err) return callback(err);
        const row = rows && rows.length > 0 ? rows[0] : null;
        callback(null, row ? { ...DEFAULT_SECURITY, ...row } : { ...DEFAULT_SECURITY, restaurant_id: restaurantId });
    });
};

const saveSecuritySettings = (restaurantId, data, callback) => {
    const sql = `
        INSERT INTO security_settings
            (restaurant_id, session_timeout_hours, discount_approval,
             refund_approval, cancel_order_approval, menu_price_change_approval)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            session_timeout_hours    = VALUES(session_timeout_hours),
            discount_approval        = VALUES(discount_approval),
            refund_approval          = VALUES(refund_approval),
            cancel_order_approval    = VALUES(cancel_order_approval),
            menu_price_change_approval = VALUES(menu_price_change_approval)
    `;
    const timeout = Number(data.session_timeout_hours) || 8;
    const values = [
        restaurantId,
        Math.max(1, Math.min(24, timeout)),
        data.discount_approval ? 1 : 0,
        data.refund_approval ? 1 : 0,
        data.cancel_order_approval ? 1 : 0,
        data.menu_price_change_approval ? 1 : 0
    ];
    db.query(sql, values, callback);
};

// ── 3b. Order Number Format ────────────────────────────────────
// How NEW order numbers are built (utils/orderNumber.js). One row per
// restaurant; current_sequence is the last issued number in the current bucket
// and sequence_reset_key records which bucket that is (see migration 022).

const DEFAULT_ORDER_NUMBER_FORMAT = {
    prefix: "ORD",
    starting_number: 1,
    digits: 4,
    reset_mode: "never",
    current_sequence: 0,
    sequence_reset_key: null
};

const ORDER_NUMBER_RESET_MODES = ["never", "daily", "monthly"];

const getOrderNumberSettings = (restaurantId, callback) => {
    db.query(
        `SELECT prefix, starting_number, digits, reset_mode, current_sequence, sequence_reset_key
         FROM order_number_settings WHERE restaurant_id = ?`,
        [restaurantId],
        (err, rows) => {
            if (err) return callback(err);
            const row = rows && rows.length > 0 ? rows[0] : null;
            callback(null, row
                ? { ...DEFAULT_ORDER_NUMBER_FORMAT, ...row }
                : { ...DEFAULT_ORDER_NUMBER_FORMAT, restaurant_id: restaurantId });
        }
    );
};

const saveOrderNumberSettings = (restaurantId, data, callback) => {
    const prefix = String(data.prefix || "ORD").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20) || "ORD";
    const starting = Math.max(1, Math.round(Number(data.starting_number)) || 1);
    const digits = Math.max(1, Math.min(10, Math.round(Number(data.digits)) || 4));
    const mode = ORDER_NUMBER_RESET_MODES.includes(data.reset_mode) ? data.reset_mode : "never";

    // Changing the shape of the number (prefix, starting number, or width)
    // starts the sequence over from the new starting number — ORD-0001 becomes
    // INV-0001. Existing orders keep the numbers they were created with. A save
    // that changes nothing (or only the reset mode) leaves the sequence alone.
    db.query(
        "SELECT prefix, starting_number, digits, current_sequence, sequence_reset_key FROM order_number_settings WHERE restaurant_id = ?",
        [restaurantId],
        (err, rows) => {
            if (err) return callback(err);
            const prev = rows && rows[0];
            const formatChanged = !prev
                || prev.prefix !== prefix
                || Number(prev.starting_number) !== starting
                || Number(prev.digits) !== digits;

            const currentSequence = formatChanged ? starting - 1 : (prev ? Number(prev.current_sequence) || 0 : starting - 1);
            const resetKey = formatChanged ? null : (prev ? prev.sequence_reset_key : null);

            const sql = `
                INSERT INTO order_number_settings
                    (restaurant_id, prefix, starting_number, digits, reset_mode, current_sequence, sequence_reset_key)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    prefix             = VALUES(prefix),
                    starting_number    = VALUES(starting_number),
                    digits             = VALUES(digits),
                    reset_mode         = VALUES(reset_mode),
                    current_sequence   = VALUES(current_sequence),
                    sequence_reset_key = VALUES(sequence_reset_key)
            `;
            db.query(sql, [restaurantId, prefix, starting, digits, mode, currentSequence, resetKey], callback);
        }
    );
};

// ── 4. Staff / Permissions ─────────────────────────────────────

const getRoles = (restaurantId, callback) => {
    const sql = `
        SELECT r.id, r.role_name, r.description, r.status
        FROM roles r
        WHERE r.restaurant_id = ?
        ORDER BY r.role_name
    `;
    db.query(sql, [restaurantId], callback);
};

const getPermissions = (callback) => {
    const sql = "SELECT * FROM permissions ORDER BY module_name, permission_name";
    db.query(sql, callback);
};

const getRolePermissions = (roleId, callback) => {
    const sql = "SELECT permission_id FROM role_permissions WHERE role_id = ?";
    db.query(sql, [roleId], callback);
};

const saveRolePermissions = (roleId, permissionIds, callback) => {
    db.query("DELETE FROM role_permissions WHERE role_id = ?", [roleId], (err) => {
        if (err) return callback(err);
        if (!permissionIds || permissionIds.length === 0) return callback(null);
        const values = permissionIds.map((pid) => [roleId, pid]);
        db.query("INSERT INTO role_permissions (role_id, permission_id) VALUES ?", [values], callback);
    });
};

// ── 5. Password Change ─────────────────────────────────────────

const getUserById = (userId, callback) => {
    const sql = "SELECT id, password FROM users WHERE id = ?";
    db.query(sql, [userId], (err, rows) => {
        if (err) return callback(err);
        callback(null, rows && rows.length > 0 ? rows[0] : null);
    });
};

const changePassword = (userId, newHashedPassword, callback) => {
    const sql = "UPDATE users SET password = ? WHERE id = ?";
    db.query(sql, [newHashedPassword, userId], callback);
};

module.exports = {
    DEFAULT_RESTAURANT,
    DEFAULT_PAYMENT,
    DEFAULT_SECURITY,
    getRestaurantSettings,
    saveRestaurantSettings,
    saveDiscountSettings,
    getDiscountPolicy,
    saveWhatsAppSettings,
    getPaymentSettings,
    savePaymentSettings,
    getSecuritySettings,
    saveSecuritySettings,
    getOrderNumberSettings,
    saveOrderNumberSettings,
    getRoles,
    getPermissions,
    getRolePermissions,
    saveRolePermissions,
    getUserById,
    changePassword
};
