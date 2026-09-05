-- 009_settings_unique_restaurant.sql
--
-- settings.restaurant_id was a plain KEY, not UNIQUE. Every other per-restaurant
-- settings table (printer_settings, bill_formats, payment_settings,
-- security_settings) declares it UNIQUE; `settings` came from the original
-- schema dump and was missed.
--
-- The consequence is not cosmetic. settingsModel.saveRestaurantSettings is an
-- INSERT ... ON DUPLICATE KEY UPDATE, and with nothing unique to collide on it
-- can never take the UPDATE branch — so every save INSERTS ANOTHER ROW. Reads
-- are `WHERE restaurant_id = ? LIMIT 1`, which returns the oldest row. Net
-- effect: the first save after a clean row works, and every save after that
-- silently does nothing. An admin changes the GST rate, sees it accepted, and
-- the bill keeps using the old one.
--
-- Deduplicate keeping the HIGHEST id per restaurant — the most recently written
-- row, i.e. what the admin last actually intended — then add the constraint so
-- the upsert works from now on.

DELETE s1 FROM settings s1
INNER JOIN settings s2
    ON s1.restaurant_id = s2.restaurant_id
   AND s1.id < s2.id;

ALTER TABLE settings
    ADD UNIQUE KEY uq_settings_restaurant (restaurant_id);
