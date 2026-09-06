-- 011_charge_removable.sql
--
-- "Apply to all, but the cashier can drop it."
--
-- An ordinary charge (packing, AC, a parcel fee) can now be marked to apply to
-- every matching bill AND still be removable by whoever settles it. It reaches
-- the bill screen as a PRE-SELECTED chip in Additional Charges — already in the
-- total, but the cashier/waiter can tap it off.
--
-- This is distinct from the two behaviours that came before:
--
--   auto_apply = 1, removable = 0  -> locked: always on, cannot be removed
--                                     (this is where GST / service charge stay)
--   auto_apply = 1, removable = 1  -> pre-selected, removable  (NEW: parcel …)
--   auto_apply = 0                 -> an opt-in chip that starts unselected
--
-- removable is only meaningful for an auto-applied ordinary (role 'Charge') row.
-- Tax and service rows are always locked, so the column stays 0 for them.
--
-- The biller enforces only the LOCKED autos server-side (utils/billing.js
-- isLockedAuto). A removable auto is applied from the charge list the screen
-- sends back at settle, so dropping the chip actually drops the charge.
--
-- Applied automatically at boot by migrations/syncColumns.js. Default 0 means no
-- existing charge changes behaviour on upgrade.

ALTER TABLE charges
    ADD COLUMN removable TINYINT(1) NOT NULL DEFAULT 0 AFTER auto_apply;
