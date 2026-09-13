-- 016_salon_discounts.sql
--
-- Discounts at the front desk, on the owner's terms.
--
-- 1) settings.discount_*  — the owner's rule (Admin → Settings → Discounts).
--      discount_enabled      0 = the receptionist can't discount at all
--      discount_max_percent  the largest % off a bill (0 = no % discounts)
--      discount_max_amount   the largest flat ₹ off a bill (0 = no flat discounts)
--    `settings` syncs cloud -> till, so the rule reaches the desk. The backend
--    enforces it when a bill is created (utils/discountRules.js); the owner's
--    own bills are capped only by the bill itself.
--
-- 2) orders.discount_percent — the rate a percentage discount was given at, so
--    correcting a bill re-takes the same % off the new subtotal. NULL for a flat
--    discount (orders.discount keeps the rupees) and for no discount.
--
-- The discount comes off the goods BEFORE tax: GST and percentage charges are
-- worked out on the discounted amount (utils/billing.js totalsFromSubtotal).
--
-- Applied automatically at boot by server.js.

ALTER TABLE settings
    ADD COLUMN discount_enabled     TINYINT(1)    NOT NULL DEFAULT 0,
    ADD COLUMN discount_max_percent DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
    ADD COLUMN discount_max_amount  DECIMAL(10,2) NOT NULL DEFAULT 0.00;

ALTER TABLE orders
    ADD COLUMN discount_percent DECIMAL(5,2) NULL DEFAULT NULL AFTER discount;
