-- 013_business_type_inventory.sql
--
-- 1) restaurants.business_type — 'restaurant' | 'salon'.
--    Chosen by the super admin when the business is created and never changed
--    afterwards. Every existing tenant is a restaurant, hence the default. The
--    table keeps its name: `restaurants` means "business" throughout.
--
-- 2) inventory_items / inventory_movements — stock kept by a salon owner
--    (shampoo, colour, towels). Quantity lives on the item; every change to it
--    is a movement row, so the owner can see where stock went. Owner-managed,
--    so both sync cloud -> till like the menu.
--
-- Applied automatically at boot: the column by migrations/syncColumns.js, the
-- tables by server.js.

ALTER TABLE restaurants
    ADD COLUMN business_type VARCHAR(20) NOT NULL DEFAULT 'restaurant' AFTER restaurant_name;

CREATE TABLE IF NOT EXISTS inventory_items (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    uuid          CHAR(36) NOT NULL DEFAULT (UUID()),
    restaurant_id INT NOT NULL,
    item_name     VARCHAR(150) NOT NULL,
    sku           VARCHAR(60) DEFAULT NULL,
    category      VARCHAR(100) DEFAULT NULL,
    unit          VARCHAR(20) NOT NULL DEFAULT 'pcs',
    quantity      DECIMAL(12,2) NOT NULL DEFAULT 0,
    min_quantity  DECIMAL(12,2) NOT NULL DEFAULT 0,
    cost_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
    status        VARCHAR(10) NOT NULL DEFAULT 'Active',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY uq_inventory_items_uuid (uuid),
    KEY idx_inventory_items_restaurant (restaurant_id),
    CONSTRAINT fk_inventory_items_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    uuid              CHAR(36) NOT NULL DEFAULT (UUID()),
    restaurant_id     INT NOT NULL,
    inventory_item_id INT NOT NULL,
    -- 'In' (stock received), 'Out' (used / sold / damaged), 'Adjust' (counted)
    movement_type     VARCHAR(10) NOT NULL,
    -- Signed change to the item's quantity, and the quantity right after it.
    quantity          DECIMAL(12,2) NOT NULL,
    balance_after     DECIMAL(12,2) NOT NULL,
    note              VARCHAR(255) DEFAULT NULL,
    created_by        INT DEFAULT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY uq_inventory_movements_uuid (uuid),
    KEY idx_inventory_movements_item (inventory_item_id),
    KEY idx_inventory_movements_restaurant (restaurant_id),
    CONSTRAINT fk_inventory_movements_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT fk_inventory_movements_item
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);
