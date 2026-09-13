-- 015_order_number_per_restaurant.sql
--
-- Order numbers are per-restaurant, per-day sequences: ORD-YYYYMMDD-NNNN, with
-- NO restaurant prefix (see utils/orderNumber.js). Two restaurants therefore
-- generate the SAME number on the same day.
--
-- The cloud keeps every restaurant's orders in one `orders` table. It had a
-- GLOBAL unique index on order_number, so when the second restaurant's order
-- synced up, its INSERT ... ON DUPLICATE KEY UPDATE collided on that index and
-- OVERWROTE the first restaurant's order (uuid and all) — silent cross-tenant
-- data loss.
--
-- Fix: uniqueness is per-restaurant. Cross-DB identity is still `uuid` (the
-- sync upsert keys on it), so this only stops the accidental order_number
-- collision between restaurants.
--
-- Applied idempotently at boot by migrations/syncColumns.js.

ALTER TABLE orders
    ADD UNIQUE INDEX uq_orders_restaurant_order (restaurant_id, order_number);

ALTER TABLE orders
    DROP INDEX order_number;
