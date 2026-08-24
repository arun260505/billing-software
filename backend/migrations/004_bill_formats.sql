CREATE TABLE IF NOT EXISTS bill_formats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL UNIQUE,

    paper_size VARCHAR(20) DEFAULT 'thermal',

    show_logo TINYINT(1) DEFAULT 0,
    show_restaurant_name TINYINT(1) DEFAULT 1,
    show_address TINYINT(1) DEFAULT 1,
    show_phone TINYINT(1) DEFAULT 1,
    show_email TINYINT(1) DEFAULT 0,
    show_gst TINYINT(1) DEFAULT 1,
    show_fssai TINYINT(1) DEFAULT 0,

    show_order_number TINYINT(1) DEFAULT 1,
    show_date TINYINT(1) DEFAULT 1,
    show_time TINYINT(1) DEFAULT 1,
    show_table_name TINYINT(1) DEFAULT 1,
    show_customer_name TINYINT(1) DEFAULT 0,
    show_waiter_name TINYINT(1) DEFAULT 0,
    show_cashier_name TINYINT(1) DEFAULT 0,

    show_payment_method TINYINT(1) DEFAULT 1,

    show_item_qty TINYINT(1) DEFAULT 1,
    show_item_price TINYINT(1) DEFAULT 1,

    show_subtotal TINYINT(1) DEFAULT 1,
    show_tax TINYINT(1) DEFAULT 1,
    show_service_charge TINYINT(1) DEFAULT 1,
    show_charges TINYINT(1) DEFAULT 1,
    show_grand_total TINYINT(1) DEFAULT 1,

    header_title VARCHAR(100) DEFAULT NULL,
    footer_text VARCHAR(255) DEFAULT 'Thank you! Visit again.',
    terms_text TEXT DEFAULT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_bill_format_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id)
        ON DELETE CASCADE
);
