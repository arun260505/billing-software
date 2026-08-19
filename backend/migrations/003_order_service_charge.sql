-- Migration 003: persist the service charge on the order.
--
-- The receipt has always shown "Service (2%)" but nothing stored it, so
-- orders.grand_total never matched the amount the customer actually paid.
-- With this column the stored bill equals the printed bill, which is what
-- makes editing + reprinting a settled bill reconcile.
--
-- Safe to re-run: if the column already exists, that one line errors -> ignore.
ALTER TABLE orders ADD COLUMN service_charge DECIMAL(10,2) DEFAULT 0.00 AFTER tax;
