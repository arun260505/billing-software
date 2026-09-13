-- 018_salon_whatsapp_bills.sql
--
-- Salon bills on WhatsApp (click-to-chat, no API), owner's choices.
-- Admin → Settings → Bills & WhatsApp.
--
-- settings.bill_delivery
--     'printer_optional'  payment offers "Send on WhatsApp" and "Print"
--                         (Print also opens WhatsApp with the bill)
--     'no_printer'        payment only sends on WhatsApp; the till's Printer
--                         screen is hidden
--
-- settings.whatsapp_template
--     The owner's message, with {tags} filled from each bill
--     (src/utils/whatsappBill.js). NULL = the default message.
--
-- `settings` syncs cloud -> till, so both reach the front desk. The shop number
-- the message signs off with is restaurants.mobile (given when the super admin
-- created the business), returned as shop_mobile by GET /api/settings/restaurant.
--
-- Applied automatically at boot by server.js.

ALTER TABLE settings
    ADD COLUMN bill_delivery     VARCHAR(20) NOT NULL DEFAULT 'printer_optional',
    ADD COLUMN whatsapp_template TEXT NULL;
