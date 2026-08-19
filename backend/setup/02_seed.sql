-- InWallz Billing — starter data
--
-- Run AFTER 01_schema.sql, against the database you created:
--     mysql -u root -p inwallz_billing < backend/setup/02_seed.sql
--
-- Safe to re-run: every INSERT is guarded, so it will not duplicate rows
-- and will never delete anything you already have.
--
-- Creates one restaurant ("InWallz") with a full set of logins, plus a few
-- categories, menu items and tables so no screen comes up empty.

-- ---------------------------------------------------------------------------
-- 1) The restaurant (tenant). Everything else hangs off this row.
--    Without it, users have no restaurant_id and every screen is empty,
--    and creating a table fails because dining_tables.restaurant_id is NOT NULL.
-- ---------------------------------------------------------------------------
INSERT INTO restaurants (id, restaurant_name, owner_name, mobile, status)
SELECT 1, 'InWallz', 'InWallz Owner', '9000000000', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM restaurants WHERE id = 1);

-- ---------------------------------------------------------------------------
-- 2) Logins
--
--    Username              Password       Role         Lands on
--    --------------------  -------------  -----------  -----------------
--    inwallz               Admin@123      super_admin  /super_admin
--    admin@inwallz         Admin@123      admin        /admin/dashboard
--    cashier@inwallz       Cashier@123    cashier      /cashier
--    waiter@inwallz        Waiter@123     waiter       /waiter
--    kitchen@inwallz       Kitchen@123    kitchen      /kitchen
--
--    super_admin has restaurant_id NULL on purpose — it is above tenants.
--    Every other role MUST have restaurant_id = 1 or its screens stay blank.
-- ---------------------------------------------------------------------------
INSERT INTO users (restaurant_id, username, password, full_name, mobile, role, status)
SELECT NULL, 'inwallz', '$2b$10$hQsGlKN926LjHzkhgKGCSuU2BT/aiVkIGXzFk062H9mEdozh5v9re', 'InWallz Super Admin', '9000000001', 'super_admin', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'inwallz');

INSERT INTO users (restaurant_id, username, password, full_name, mobile, role, status)
SELECT 1, 'admin@inwallz', '$2b$10$JIhM3N.CGdPSNgrMWFElK.8OjS0BgmIpedTGb2/VeDoS1NrXiHSti', 'Restaurant Admin', '9000000002', 'admin', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin@inwallz');

INSERT INTO users (restaurant_id, username, password, full_name, mobile, role, status)
SELECT 1, 'cashier@inwallz', '$2b$10$e2qb47TsHhrZGyUtlVzoYeJB1jQ2E5nc/XGdtqq0bOWxVIwCFfXpm', 'Counter Cashier', '9000000003', 'cashier', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'cashier@inwallz');

INSERT INTO users (restaurant_id, username, password, full_name, mobile, role, status)
SELECT 1, 'waiter@inwallz', '$2b$10$6x15ISFN8u.8YFAYc/ktAOgqok4AAZxKsVoK1Hf.PgxEcKdVunFXC', 'Floor Waiter', '9000000004', 'waiter', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'waiter@inwallz');

INSERT INTO users (restaurant_id, username, password, full_name, mobile, role, status)
SELECT 1, 'kitchen@inwallz', '$2b$10$o/pxqArogRYF0ooCjEIP.e5v.5kL2iF3KP5FouzSprbO0XGcwwunS', 'Kitchen Display', '9000000005', 'kitchen', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'kitchen@inwallz');

-- ---------------------------------------------------------------------------
-- 3) Categories — the menu screen groups items by these.
-- ---------------------------------------------------------------------------
INSERT INTO categories (restaurant_id, category_name, status)
SELECT 1, 'Starters', 'Active'   WHERE NOT EXISTS (SELECT 1 FROM categories WHERE restaurant_id=1 AND category_name='Starters');
INSERT INTO categories (restaurant_id, category_name, status)
SELECT 1, 'Main Course', 'Active' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE restaurant_id=1 AND category_name='Main Course');
INSERT INTO categories (restaurant_id, category_name, status)
SELECT 1, 'Beverages', 'Active'  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE restaurant_id=1 AND category_name='Beverages');
INSERT INTO categories (restaurant_id, category_name, status)
SELECT 1, 'Desserts', 'Active'   WHERE NOT EXISTS (SELECT 1 FROM categories WHERE restaurant_id=1 AND category_name='Desserts');

-- ---------------------------------------------------------------------------
-- 4) A few menu items (gst 5 to match how the app totals a bill).
-- ---------------------------------------------------------------------------
INSERT INTO menu_items (restaurant_id, category_id, item_name, price, gst, food_type, available, description)
SELECT 1, (SELECT id FROM categories WHERE restaurant_id=1 AND category_name='Starters'),
       'Gobi Manchurian', 140.00, 5.00, 'Veg', 1, 'Crisp cauliflower tossed in a spicy sauce'
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id=1 AND item_name='Gobi Manchurian');

INSERT INTO menu_items (restaurant_id, category_id, item_name, price, gst, food_type, available, description)
SELECT 1, (SELECT id FROM categories WHERE restaurant_id=1 AND category_name='Starters'),
       'Chicken 65', 180.00, 5.00, 'NonVeg', 1, 'Classic South Indian fried chicken'
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id=1 AND item_name='Chicken 65');

INSERT INTO menu_items (restaurant_id, category_id, item_name, price, gst, food_type, available, description)
SELECT 1, (SELECT id FROM categories WHERE restaurant_id=1 AND category_name='Main Course'),
       'Veg Biryani', 190.00, 5.00, 'Veg', 1, 'Basmati rice with seasonal vegetables'
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id=1 AND item_name='Veg Biryani');

INSERT INTO menu_items (restaurant_id, category_id, item_name, price, gst, food_type, available, description)
SELECT 1, (SELECT id FROM categories WHERE restaurant_id=1 AND category_name='Main Course'),
       'Chicken Biryani', 240.00, 5.00, 'NonVeg', 1, 'Dum-cooked with whole spices'
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id=1 AND item_name='Chicken Biryani');

INSERT INTO menu_items (restaurant_id, category_id, item_name, price, gst, food_type, available, description)
SELECT 1, (SELECT id FROM categories WHERE restaurant_id=1 AND category_name='Main Course'),
       'Butter Naan', 45.00, 5.00, 'Veg', 1, 'Tandoor-baked, brushed with butter'
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id=1 AND item_name='Butter Naan');

INSERT INTO menu_items (restaurant_id, category_id, item_name, price, gst, food_type, available, description)
SELECT 1, (SELECT id FROM categories WHERE restaurant_id=1 AND category_name='Beverages'),
       'Fresh Lime Juice', 60.00, 5.00, 'Veg', 1, 'Served sweet, salted or mixed'
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id=1 AND item_name='Fresh Lime Juice');

INSERT INTO menu_items (restaurant_id, category_id, item_name, price, gst, food_type, available, description)
SELECT 1, (SELECT id FROM categories WHERE restaurant_id=1 AND category_name='Beverages'),
       'Filter Coffee', 40.00, 5.00, 'Veg', 1, 'Strong decoction, hot milk'
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id=1 AND item_name='Filter Coffee');

INSERT INTO menu_items (restaurant_id, category_id, item_name, price, gst, food_type, available, description)
SELECT 1, (SELECT id FROM categories WHERE restaurant_id=1 AND category_name='Desserts'),
       'Gulab Jamun', 70.00, 5.00, 'Veg', 1, 'Two pieces, warm syrup'
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id=1 AND item_name='Gulab Jamun');

-- ---------------------------------------------------------------------------
-- 5) Dining tables. The UI shows these as T1 / T2 / T3.
--    tableService.js maps dining_tables.table_name -> table_number for the UI.
-- ---------------------------------------------------------------------------
INSERT INTO dining_tables (restaurant_id, table_name, capacity, location, status, current_bill)
SELECT 1, '1', 4, 'Hall', 'Available', 0
WHERE NOT EXISTS (SELECT 1 FROM dining_tables WHERE restaurant_id=1 AND table_name='1');

INSERT INTO dining_tables (restaurant_id, table_name, capacity, location, status, current_bill)
SELECT 1, '2', 2, 'Hall', 'Available', 0
WHERE NOT EXISTS (SELECT 1 FROM dining_tables WHERE restaurant_id=1 AND table_name='2');

INSERT INTO dining_tables (restaurant_id, table_name, capacity, location, status, current_bill)
SELECT 1, '3', 6, 'Terrace', 'Available', 0
WHERE NOT EXISTS (SELECT 1 FROM dining_tables WHERE restaurant_id=1 AND table_name='3');

-- ---------------------------------------------------------------------------
-- Done. Check it landed:
--     SELECT username, role, restaurant_id FROM users;
--     SELECT COUNT(*) FROM menu_items;
--     SELECT COUNT(*) FROM dining_tables;
-- ---------------------------------------------------------------------------
