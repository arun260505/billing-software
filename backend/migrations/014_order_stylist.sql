-- 014_order_stylist.sql
--
-- A salon bill names the stylist who did the work, so the owner can see who
-- served how many customers and for how much.
--
-- Stylists are `users` rows with role = 'stylist' and no usable login (the
-- owner adds them by name in Employees; authModel refuses them at sign-in).
-- They sync cloud -> till with the rest of `users`, and orders carry the id
-- back up; the sync engine translates it through users.uuid like any other FK.
--
-- NULL for every restaurant order and every salon bill made before this.
--
-- Applied automatically at boot by migrations/syncColumns.js.

ALTER TABLE orders
    ADD COLUMN stylist_id INT NULL DEFAULT NULL AFTER employee_id;
