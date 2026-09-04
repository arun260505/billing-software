const db = require("../config/db");

const DEFAULT_BILL_FORMAT = {
    paper_size: "thermal",
    show_logo: 0,
    show_restaurant_name: 1,
    show_address: 1,
    show_phone: 1,
    show_email: 0,
    show_gst: 1,
    show_fssai: 0,
    show_order_number: 1,
    show_date: 1,
    show_time: 1,
    show_table_name: 1,
    show_customer_name: 0,
    show_waiter_name: 0,
    show_cashier_name: 0,
    show_payment_method: 1,
    show_item_qty: 1,
    show_item_price: 1,
    show_subtotal: 1,
    show_tax: 1,
    show_service_charge: 1,
    show_charges: 1,
    show_grand_total: 1,
    header_title: "",
    footer_text: "Thank you! Visit again.",
    terms_text: ""
};

const getBillFormat = (restaurantId, callback) => {
    // tax_percentage / service_charge live on `settings`, not `restaurants`, but
    // the till screens need them to show the same total the backend will store.
    // Joined in here because the cashier and waiter already poll this endpoint —
    // it saves them a second round trip just to learn the rates.
    const restaurantSql = `
        SELECT r.id, r.restaurant_name, r.owner_name, r.mobile, r.email,
               r.gst_number, r.fssai_number, r.address, r.city, r.state,
               r.pincode, r.logo,
               s.tax_percentage, s.service_charge
        FROM restaurants r
        LEFT JOIN settings s ON s.restaurant_id = r.id
        WHERE r.id = ?
    `;
    const formatSql = "SELECT * FROM bill_formats WHERE restaurant_id = ?";

    db.query(restaurantSql, [restaurantId], (restErr, restResults) => {
        if (restErr) return callback(restErr);

        const restaurant = restResults && restResults.length > 0 ? restResults[0] : null;

        db.query(formatSql, [restaurantId], (formatErr, formatResults) => {
            if (formatErr) return callback(formatErr);

            const format = (formatResults && formatResults.length > 0)
                ? { ...DEFAULT_BILL_FORMAT, ...formatResults[0] }
                : { ...DEFAULT_BILL_FORMAT, restaurant_id: restaurantId };

            callback(null, {
                format,
                restaurant
            });
        });
    });
};

const saveBillFormat = (restaurantId, data, callback) => {
    const sql = `
        INSERT INTO bill_formats (
            restaurant_id,
            paper_size,
            show_logo,
            show_restaurant_name,
            show_address,
            show_phone,
            show_email,
            show_gst,
            show_fssai,
            show_order_number,
            show_date,
            show_time,
            show_table_name,
            show_customer_name,
            show_waiter_name,
            show_cashier_name,
            show_payment_method,
            show_item_qty,
            show_item_price,
            show_subtotal,
            show_tax,
            show_service_charge,
            show_charges,
            show_grand_total,
            header_title,
            footer_text,
            terms_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            paper_size = VALUES(paper_size),
            show_logo = VALUES(show_logo),
            show_restaurant_name = VALUES(show_restaurant_name),
            show_address = VALUES(show_address),
            show_phone = VALUES(show_phone),
            show_email = VALUES(show_email),
            show_gst = VALUES(show_gst),
            show_fssai = VALUES(show_fssai),
            show_order_number = VALUES(show_order_number),
            show_date = VALUES(show_date),
            show_time = VALUES(show_time),
            show_table_name = VALUES(show_table_name),
            show_customer_name = VALUES(show_customer_name),
            show_waiter_name = VALUES(show_waiter_name),
            show_cashier_name = VALUES(show_cashier_name),
            show_payment_method = VALUES(show_payment_method),
            show_item_qty = VALUES(show_item_qty),
            show_item_price = VALUES(show_item_price),
            show_subtotal = VALUES(show_subtotal),
            show_tax = VALUES(show_tax),
            show_service_charge = VALUES(show_service_charge),
            show_charges = VALUES(show_charges),
            show_grand_total = VALUES(show_grand_total),
            header_title = VALUES(header_title),
            footer_text = VALUES(footer_text),
            terms_text = VALUES(terms_text)
    `;

    const toBool = (val, fallback = 0) => (val === undefined ? fallback : val ? 1 : 0);

    const values = [
        restaurantId,
        data.paper_size || "thermal",
        toBool(data.show_logo, 0),
        toBool(data.show_restaurant_name, 1),
        toBool(data.show_address, 1),
        toBool(data.show_phone, 1),
        toBool(data.show_email, 0),
        toBool(data.show_gst, 1),
        toBool(data.show_fssai, 0),
        toBool(data.show_order_number, 1),
        toBool(data.show_date, 1),
        toBool(data.show_time, 1),
        toBool(data.show_table_name, 1),
        toBool(data.show_customer_name, 0),
        toBool(data.show_waiter_name, 0),
        toBool(data.show_cashier_name, 0),
        toBool(data.show_payment_method, 1),
        toBool(data.show_item_qty, 1),
        toBool(data.show_item_price, 1),
        toBool(data.show_subtotal, 1),
        toBool(data.show_tax, 1),
        toBool(data.show_service_charge, 1),
        toBool(data.show_charges, 1),
        toBool(data.show_grand_total, 1),
        data.header_title != null ? data.header_title.trim() : null,
        data.footer_text != null ? data.footer_text : "Thank you! Visit again.",
        data.terms_text != null ? data.terms_text : null
    ];

    db.query(sql, values, callback);
};

const updateRestaurantBranding = (restaurantId, data, callback) => {
    const sql = `
        UPDATE restaurants
        SET
            restaurant_name = COALESCE(?, restaurant_name),
            address = ?,
            city = ?,
            state = ?,
            pincode = ?,
            mobile = COALESCE(?, mobile),
            email = ?,
            gst_number = ?,
            fssai_number = ?,
            logo = ?
        WHERE id = ?
    `;

    const values = [
        data.restaurant_name ? data.restaurant_name.trim() : null,
        data.address != null ? data.address.trim() : null,
        data.city != null ? data.city.trim() : null,
        data.state != null ? data.state.trim() : null,
        data.pincode != null ? data.pincode.trim() : null,
        data.mobile ? data.mobile.trim() : null,
        data.email != null ? data.email.trim() : null,
        data.gst_number != null ? data.gst_number.trim() : null,
        data.fssai_number != null ? data.fssai_number.trim() : null,
        data.logo !== undefined ? (data.logo || null) : null,
        restaurantId
    ];

    db.query(sql, values, callback);
};

module.exports = {
    DEFAULT_BILL_FORMAT,
    getBillFormat,
    saveBillFormat,
    updateRestaurantBranding
};
