-- =============================================================================
-- Migration 001: make the `users` table multi-tenant ready
-- =============================================================================
-- WHY: the app was upgraded to multi-tenant. Every login and every employee
-- carries a restaurant_id taken from the JWT, and the employee module stores
-- mobile/email. The original `users` table did not have these columns, and its
-- password column may be too short to hold a 60-character bcrypt hash.
--
-- Symptoms this fixes:
--   * "Failed to create" employee  -> INSERT references missing columns
--   * "Invalid username or password" for a freshly created employee
--                                   -> bcrypt hash truncated by a short column
--   * "Unknown column 'u.restaurant_id'" on login
--
-- HOW TO RUN (on the machine whose database is behind):
--   Option A - MySQL CLI:
--     mysql -u <user> -p <database_name> < backend/migrations/001_multitenant_users.sql
--   Option B - MySQL Workbench / phpMyAdmin:
--     open this file, select your database, run it.
--
-- Safe to run once. If a column already exists MySQL will report an error for
-- just that line; ignore it and continue.
-- =============================================================================

-- 1) Password must hold a full bcrypt hash (60 chars). Widen to be safe.
ALTER TABLE users
    MODIFY COLUMN password VARCHAR(255) NOT NULL;

-- 2) Role must allow every app role. VARCHAR avoids ENUM value restrictions
--    (this is what causes "failed to create" for waiter / kitchen).
ALTER TABLE users
    MODIFY COLUMN role VARCHAR(30) NOT NULL;

-- 3) Tenant + contact columns the employee module writes.
--    (If any of these already exist, that single line will error - just skip it.)
ALTER TABLE users
    ADD COLUMN restaurant_id INT NULL AFTER id;

ALTER TABLE users
    ADD COLUMN mobile VARCHAR(20) NULL AFTER full_name;

ALTER TABLE users
    ADD COLUMN email VARCHAR(120) NULL AFTER mobile;

-- 4) Optional: enforce that restaurant_id points at a real restaurant.
--    Skip this line if it errors (e.g. the constraint already exists).
ALTER TABLE users
    ADD CONSTRAINT fk_users_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);

-- =============================================================================
-- 5) BACKFILL (edit these to match YOUR data)
-- =============================================================================
-- Every admin/cashier/waiter/kitchen user must belong to a restaurant, or their
-- tenant-scoped screens will be empty. super_admin stays NULL.
--
-- First see what you have:
--     SELECT id, username, role, restaurant_id FROM users;
--     SELECT id, restaurant_name FROM restaurants;
--
-- Then assign each non-super_admin user to the right restaurant id, e.g.:
--     UPDATE users SET restaurant_id = 1 WHERE username = 'youradmin@gmail.com';
--
-- (super_admin is intentionally left as restaurant_id = NULL.)
-- =============================================================================
