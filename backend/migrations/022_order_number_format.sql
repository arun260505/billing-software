-- 022_order_number_format.sql
--
-- Order numbers are now built from a per-restaurant, admin-configured format,
-- persisted here and read by utils/orderNumber.js. The old per-day counter
-- (order_sequences, ORD-DDMM-NNN) is left untouched — existing orders keep
-- their numbers, and the new generator simply stops using that table.
--
-- Columns:
--   prefix              the label before the dash, e.g. "ORD" or "INV"
--   starting_number     the first sequence number (1 = ORD-0001)
--   digits              the zero-padded width of the sequence, e.g. 4 → 0001
--   reset_mode          'never' | 'daily' | 'monthly'
--   current_sequence    the last number issued in the current bucket
--   sequence_reset_key  which bucket that is: a calendar day (YYYY-MM-DD),
--                       a year-month (YYYY-MM), or '' for 'never'. NULL means
--                       a freshly saved format that has not issued a number
--                       yet, so the next order starts from starting_number.
--
-- current_sequence advances inside a transaction (SELECT ... FOR UPDATE on this
-- row), which is what keeps two tills issuing orders at the same instant from
-- handing out the same number.
--
-- Applied idempotently at boot by the inline CREATE TABLE in server.js
-- (same pattern as payment_settings / security_settings). A fresh database gets
-- the table from there too, so this file is a record of the change rather than
-- a migration that is run directly.

CREATE TABLE IF NOT EXISTS order_number_settings (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id        INT NOT NULL UNIQUE,
    prefix               VARCHAR(20) NOT NULL DEFAULT 'ORD',
    starting_number      INT NOT NULL DEFAULT 1,
    digits               INT NOT NULL DEFAULT 4,
    reset_mode           VARCHAR(10) NOT NULL DEFAULT 'never',
    current_sequence     INT NOT NULL DEFAULT 0,
    sequence_reset_key   VARCHAR(10) DEFAULT NULL,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_number_settings_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;