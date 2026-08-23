CREATE TABLE IF NOT EXISTS charges (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id    INT NOT NULL,
    charge_name      VARCHAR(100) NOT NULL,
    description      TEXT DEFAULT NULL,
    charge_type      VARCHAR(20) NOT NULL DEFAULT 'Fixed',
    amount           DECIMAL(10,2) NOT NULL DEFAULT 0,
    applies_dinein   TINYINT(1) DEFAULT 1,
    applies_takeaway TINYINT(1) DEFAULT 0,
    applies_delivery TINYINT(1) DEFAULT 0,
    apply_tax        TINYINT(1) DEFAULT 1,
    status           VARCHAR(10) DEFAULT 'Active',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);
