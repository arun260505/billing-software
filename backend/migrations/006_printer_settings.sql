-- Which printer setup a restaurant runs, chosen in Admin → Settings.
--
--   cashier_kds    Option 1 — one cashier printer + the Kitchen Display screen.
--                  Nothing is printed for the kitchen; it reads the display.
--   dual_printer   Option 2 — a cashier printer and a separate kitchen printer.
--                  The KOT prints as soon as an order is sent to the kitchen.
--   single_printer Option 3 — one printer for everything. Counter/walk-in orders
--                  print the customer bill followed by the kitchen bill; table
--                  orders print the bill only (the kitchen is told by hand).

CREATE TABLE IF NOT EXISTS printer_settings (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT NOT NULL UNIQUE,
    printer_mode  VARCHAR(30) DEFAULT 'dual_printer',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_printer_setting_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id)
        ON DELETE CASCADE
);
