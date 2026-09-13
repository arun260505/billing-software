-- 017_payment_number_per_restaurant.sql
--
-- The payment-number twin of migration 015. Payment numbers are per-business,
-- per-day sequences: PAY-YYYYMMDD-NNNN, with NO business prefix. Two businesses
-- therefore generate the SAME number on the same day (both start at
-- PAY-...-0001).
--
-- The cloud keeps every business's payments in one `payments` table. It had a
-- GLOBAL unique index on payment_number, so the SECOND business to take its
-- first payment of the day errored (duplicate) — or, on sync, one payment could
-- overwrite the other. Cross-DB identity is `uuid`; uniqueness of the
-- human-readable number only needs to hold within a business.
--
-- Applied idempotently at boot by migrations/syncColumns.js.

ALTER TABLE payments
    ADD UNIQUE INDEX uq_payments_restaurant_payment (restaurant_id, payment_number);

ALTER TABLE payments
    DROP INDEX payment_number;
