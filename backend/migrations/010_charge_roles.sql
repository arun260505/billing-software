-- 010_charge_roles.sql
--
-- GST and the service charge move out of `settings` and into `charges`.
--
-- They used to be settings.tax_percentage / settings.service_charge, applied to
-- every bill by utils/billing.js — and, because "0" was read as "never
-- configured", a restaurant that left them blank was billed a hardcoded 5% GST
-- + 2% service charge that no screen in the product could switch off. Plenty of
-- restaurants are not registered for GST and do not levy service.
--
-- Now every line added on top of the goods is a row in `charges`:
--
--   charge_role = 'Tax'     -> summed into orders.tax           (GST reporting)
--   charge_role = 'Service' -> summed into orders.service_charge
--   charge_role = 'Charge'  -> itemised in order_charges         (packing, AC …)
--
--   auto_apply = 1 -> lands on every bill of a matching order type
--   auto_apply = 0 -> an opt-in chip the cashier taps at settle time
--
-- No charge rows means no tax and no service charge. That is the point.
--
-- The backfill below preserves what each EXISTING restaurant was already being
-- billed, so no till changes what it charges on upgrade — the difference is
-- that the GST row is now visible in Admin -> Charges and can be edited,
-- switched off or deleted. New restaurants start with neither.
--
-- Applied automatically at boot by migrations/syncColumns.js, which runs the
-- backfill only in the same pass that first adds charge_role (so deleting the
-- seeded GST row does not bring it back on the next restart).

ALTER TABLE charges
    ADD COLUMN charge_role VARCHAR(10) NOT NULL DEFAULT 'Charge' AFTER charge_type;

ALTER TABLE charges
    ADD COLUMN auto_apply TINYINT(1) NOT NULL DEFAULT 0 AFTER amount;

-- Backfill: one GST row and one service-charge row per restaurant, at whatever
-- rate that restaurant was effectively being billed at (its configured rate, or
-- the historical 5% / 2% it was getting when the columns were left at 0).
--
-- The `charges` subquery is wrapped in a derived table because MySQL refuses to
-- read the target of an INSERT inside its own SELECT (error 1093). The runtime
-- version of this backfill (syncColumns.js) does it as two statements instead.
INSERT INTO charges
    (restaurant_id, charge_name, description, charge_type, charge_role, amount,
     auto_apply, applies_dinein, applies_takeaway, applies_delivery, apply_tax, status)
SELECT
    r.id,
    CONCAT('GST ', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM
        FORMAT(IF(COALESCE(s.tax_percentage, 0) > 0, s.tax_percentage, 5), 2))), '%'),
    'Carried over from Settings when GST moved into Charges. Edit or delete it if this restaurant does not charge GST.',
    'Percentage',
    'Tax',
    IF(COALESCE(s.tax_percentage, 0) > 0, s.tax_percentage, 5),
    1, 1, 1, 1, 0, 'Active'
FROM restaurants r
LEFT JOIN settings s ON s.restaurant_id = r.id
WHERE NOT EXISTS (
    SELECT 1 FROM (SELECT restaurant_id, charge_role FROM charges) c
    WHERE c.restaurant_id = r.id AND c.charge_role = 'Tax'
);

-- Dine-in only, which is where a service charge belongs and what the old
-- hardcoded one effectively was.
INSERT INTO charges
    (restaurant_id, charge_name, description, charge_type, charge_role, amount,
     auto_apply, applies_dinein, applies_takeaway, applies_delivery, apply_tax, status)
SELECT
    r.id,
    CONCAT('Service Charge ', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM
        FORMAT(IF(COALESCE(s.service_charge, 0) > 0, s.service_charge, 2), 2))), '%'),
    'Carried over from Settings when the service charge moved into Charges. Edit or delete it if this restaurant does not levy one.',
    'Percentage',
    'Service',
    IF(COALESCE(s.service_charge, 0) > 0, s.service_charge, 2),
    1, 1, 0, 0, 0, 'Active'
FROM restaurants r
LEFT JOIN settings s ON s.restaurant_id = r.id
WHERE NOT EXISTS (
    SELECT 1 FROM (SELECT restaurant_id, charge_role FROM charges) c
    WHERE c.restaurant_id = r.id AND c.charge_role = 'Service'
);
