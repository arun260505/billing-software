-- 008_order_charges.sql
--
-- Per-bill charges (packing, delivery, AC …) were added to the printed receipt
-- and to the recorded payment, but never stored on the order. So
-- orders.grand_total was goods + tax + service only, and any report summing it
-- under-reported what the restaurant actually took. Reprinting a settled bill
-- also lost the charge lines entirely, because nothing remembered their names.
--
-- Stores them itemised (for an accurate reprint) plus a rolled-up total on the
-- order (so grand_total is the whole amount owed).

CREATE TABLE IF NOT EXISTS order_charges (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    order_id    INT NOT NULL,
    charge_name VARCHAR(100) NOT NULL,
    amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_order_charges_order (order_id),
    CONSTRAINT fk_order_charges_order
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Rolled-up charge total, so totalling a bill never needs a join.
ALTER TABLE orders
    ADD COLUMN charges_total DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER service_charge;
