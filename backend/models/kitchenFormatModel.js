const db = require("../config/db");

const DEFAULT_KITCHEN_FORMAT = {
    paper_size: "thermal",
    show_logo: 0,
    show_restaurant_name: 1,
    show_address: 0,
    show_phone: 0,
    show_order_number: 1,
    show_date: 1,
    show_time: 1,
    show_order_type: 1,
    show_table_name: 1,
    show_customer_name: 0,
    show_waiter_name: 1,
    show_cashier_name: 0,
    show_item_qty: 1,
    show_item_name: 1,
    show_item_notes: 1,
    show_item_category: 0,
    header_title: "KITCHEN ORDER TICKET",
    footer_text: "Please prepare carefully."
};

const getKitchenFormat = (restaurantId, callback) => {
    const restaurantSql = "SELECT id, restaurant_name, owner_name, mobile, email, address, city, state, pincode, logo FROM restaurants WHERE id = ?";
    const formatSql = "SELECT * FROM kitchen_formats WHERE restaurant_id = ?";

    db.query(restaurantSql, [restaurantId], (restErr, restResults) => {
        if (restErr) return callback(restErr);

        const restaurant = restResults && restResults.length > 0 ? restResults[0] : null;

        db.query(formatSql, [restaurantId], (formatErr, formatResults) => {
            if (formatErr) return callback(formatErr);

            const format = (formatResults && formatResults.length > 0)
                ? { ...DEFAULT_KITCHEN_FORMAT, ...formatResults[0] }
                : { ...DEFAULT_KITCHEN_FORMAT, restaurant_id: restaurantId };

            callback(null, {
                format,
                restaurant
            });
        });
    });
};

const saveKitchenFormat = (restaurantId, data, callback) => {
    const sql = `
        INSERT INTO kitchen_formats (
            restaurant_id,
            paper_size,
            show_logo,
            show_restaurant_name,
            show_address,
            show_phone,
            show_order_number,
            show_date,
            show_time,
            show_order_type,
            show_table_name,
            show_customer_name,
            show_waiter_name,
            show_cashier_name,
            show_item_qty,
            show_item_name,
            show_item_notes,
            show_item_category,
            header_title,
            footer_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            paper_size = VALUES(paper_size),
            show_logo = VALUES(show_logo),
            show_restaurant_name = VALUES(show_restaurant_name),
            show_address = VALUES(show_address),
            show_phone = VALUES(show_phone),
            show_order_number = VALUES(show_order_number),
            show_date = VALUES(show_date),
            show_time = VALUES(show_time),
            show_order_type = VALUES(show_order_type),
            show_table_name = VALUES(show_table_name),
            show_customer_name = VALUES(show_customer_name),
            show_waiter_name = VALUES(show_waiter_name),
            show_cashier_name = VALUES(show_cashier_name),
            show_item_qty = VALUES(show_item_qty),
            show_item_name = VALUES(show_item_name),
            show_item_notes = VALUES(show_item_notes),
            show_item_category = VALUES(show_item_category),
            header_title = VALUES(header_title),
            footer_text = VALUES(footer_text)
    `;

    const toBool = (val, fallback = 0) => (val === undefined ? fallback : val ? 1 : 0);

    const values = [
        restaurantId,
        data.paper_size || "thermal",
        toBool(data.show_logo, 0),
        toBool(data.show_restaurant_name, 1),
        toBool(data.show_address, 0),
        toBool(data.show_phone, 0),
        toBool(data.show_order_number, 1),
        toBool(data.show_date, 1),
        toBool(data.show_time, 1),
        toBool(data.show_order_type, 1),
        toBool(data.show_table_name, 1),
        toBool(data.show_customer_name, 0),
        toBool(data.show_waiter_name, 1),
        toBool(data.show_cashier_name, 0),
        toBool(data.show_item_qty, 1),
        toBool(data.show_item_name, 1),
        toBool(data.show_item_notes, 1),
        toBool(data.show_item_category, 0),
        data.header_title != null ? data.header_title.trim() : "KITCHEN ORDER TICKET",
        data.footer_text != null ? data.footer_text : "Please prepare carefully."
    ];

    db.query(sql, values, callback);
};

module.exports = {
    DEFAULT_KITCHEN_FORMAT,
    getKitchenFormat,
    saveKitchenFormat
};
