-- Migration 002: per-item "served" tracking on order_items.
-- Lets the waiter/cashier mark individual items served; when all of an order's
-- items are served the order becomes Served and leaves the kitchen display.
-- Safe to re-run: if the column already exists, that one line errors -> ignore.
ALTER TABLE order_items ADD COLUMN served TINYINT(1) NOT NULL DEFAULT 0;
