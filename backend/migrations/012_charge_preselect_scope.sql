-- 012_charge_preselect_scope.sql
--
-- For a REMOVABLE extra charge (see 011), admin decides where it STARTS ticked
-- on the bill screen — the cashier and the waiter app can differ:
--
--   preselect_cashier = 1  -> starts ticked on the cashier bill (default)
--   preselect_waiter  = 0  -> starts UNticked on the waiter app (default)
--
-- The counter usually adds parcel/packing, so the cashier defaults ON; the
-- waiter bills what was eaten and ticks an extra only when the customer also
-- parcels, so the waiter defaults OFF. Either can be flipped per charge.
--
-- Only meaningful for a removable extra. Locked autos (GST/service) are always
-- applied; opt-in chips always start unticked.
--
-- Applied automatically at boot by migrations/syncColumns.js.

ALTER TABLE charges
    ADD COLUMN preselect_cashier TINYINT(1) NOT NULL DEFAULT 1 AFTER removable;

ALTER TABLE charges
    ADD COLUMN preselect_waiter TINYINT(1) NOT NULL DEFAULT 0 AFTER preselect_cashier;
