-- The actual printer devices the cashier till prints to, recorded on the
-- cashier's Printer page. Which of the two is asked for depends on
-- printer_settings.printer_mode (see 006_printer_settings.sql):
--
--   cashier_kds     cashier_printer only — the kitchen reads the display
--   dual_printer    both — bills go to cashier_printer, KOTs to kitchen_printer
--   single_printer  cashier_printer only — it prints the bill and the kitchen copy
--
-- Names are the Windows printer names as reported by Get-Printer, so the
-- cashier page can match them against what is actually installed on the till.

ALTER TABLE printer_settings
    ADD COLUMN cashier_printer VARCHAR(150) DEFAULT NULL,
    ADD COLUMN kitchen_printer VARCHAR(150) DEFAULT NULL;
