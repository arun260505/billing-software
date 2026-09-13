-- 019_whatsapp_via.sql
--
-- The salon-wide default for which WhatsApp a bill opens in:
--   'web'  WhatsApp Web (browser)   [default]
--   'app'  the installed WhatsApp desktop application
--
-- Set by the owner in Admin -> Settings -> Bills & WhatsApp. Syncs cloud -> till
-- with the rest of `settings`. A till can still OVERRIDE it on its own POS
-- (per-till, kept in that machine's browser) when its WhatsApp setup differs.
--
-- Applied automatically at boot by server.js (alongside bill_delivery /
-- whatsapp_template).

ALTER TABLE settings
    ADD COLUMN whatsapp_via VARCHAR(10) NOT NULL DEFAULT 'web';
