-- =============================================================================
-- Migration 001: make the `users` table multi-tenant ready  (idempotent)
-- =============================================================================
-- WHY: the app is multi-tenant. Every login and employee carries a
-- restaurant_id from the JWT, and the employee module stores mobile/email.
-- Older databases are missing some of these columns, or have a password/role
-- column that is too narrow.
--
-- Symptoms this fixes:
--   * "Failed to create" employee   -> INSERT hits a missing column (mobile/email)
--   * "Invalid username or password" for a freshly created employee
--                                    -> bcrypt hash truncated by a short column
--   * "Unknown column 'u.restaurant_id'" on login
--
-- This script is SAFE TO RE-RUN. It checks what already exists and only adds
-- what is missing, so you will NOT get "Duplicate column" errors.
--
-- HOW TO RUN:
--   MySQL CLI:
--     Get-Content .\backend\migrations\001_multitenant_users.sql | mysql -u root -p <database_name>
--   or MySQL Workbench / phpMyAdmin: open this file, pick your DB, run it.
-- =============================================================================

-- Widening password/role is idempotent (re-applying the same type is a no-op).
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NOT NULL;
ALTER TABLE users MODIFY COLUMN role VARCHAR(30) NOT NULL;

-- Add tenant + contact columns only if they are not already there.
DROP PROCEDURE IF EXISTS _mt_add_users_columns;
DELIMITER $$
CREATE PROCEDURE _mt_add_users_columns()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = DATABASE()
                     AND table_name = 'users' AND column_name = 'restaurant_id') THEN
        ALTER TABLE users ADD COLUMN restaurant_id INT NULL AFTER id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = DATABASE()
                     AND table_name = 'users' AND column_name = 'mobile') THEN
        ALTER TABLE users ADD COLUMN mobile VARCHAR(20) NULL AFTER full_name;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = DATABASE()
                     AND table_name = 'users' AND column_name = 'email') THEN
        ALTER TABLE users ADD COLUMN email VARCHAR(120) NULL AFTER mobile;
    END IF;

    -- Add FK only if it does not already exist and a restaurants table is present.
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = 'restaurants')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE table_schema = DATABASE()
                         AND table_name = 'users'
                         AND constraint_name = 'fk_users_restaurant') THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_restaurant
            FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
    END IF;
END $$
DELIMITER ;

CALL _mt_add_users_columns();
DROP PROCEDURE _mt_add_users_columns;

-- =============================================================================
-- BACKFILL (edit to match YOUR data) -- run these by hand after the above.
-- Every admin/cashier/waiter/kitchen user must belong to a restaurant, or their
-- tenant-scoped screens will be empty. Leave super_admin as NULL.
--
--   SELECT id, username, role, restaurant_id FROM users;
--   SELECT id, restaurant_name FROM restaurants;
--   UPDATE users SET restaurant_id = 1 WHERE username = 'your_admin_username';
-- =============================================================================
