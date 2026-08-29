CREATE TABLE IF NOT EXISTS kitchen_formats (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id        INT NOT NULL UNIQUE,
    paper_size           VARCHAR(20) DEFAULT 'thermal',
    show_logo            TINYINT(1) DEFAULT 0,
    show_restaurant_name TINYINT(1) DEFAULT 1,
    show_address         TINYINT(1) DEFAULT 0,
    show_phone           TINYINT(1) DEFAULT 0,
    show_order_number    TINYINT(1) DEFAULT 1,
    show_date            TINYINT(1) DEFAULT 1,
    show_time            TINYINT(1) DEFAULT 1,
    show_order_type      TINYINT(1) DEFAULT 1,
    show_table_name      TINYINT(1) DEFAULT 1,
    show_customer_name   TINYINT(1) DEFAULT 0,
    show_waiter_name     TINYINT(1) DEFAULT 1,
    show_cashier_name    TINYINT(1) DEFAULT 0,
    show_item_qty        TINYINT(1) DEFAULT 1,
    show_item_name       TINYINT(1) DEFAULT 1,
    show_item_notes      TINYINT(1) DEFAULT 1,
    show_item_category   TINYINT(1) DEFAULT 0,
    header_title         VARCHAR(100) DEFAULT 'KITCHEN ORDER TICKET',
    footer_text          VARCHAR(255) DEFAULT 'Please prepare carefully.',
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_kitchen_format_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id)
        ON DELETE CASCADE
);
