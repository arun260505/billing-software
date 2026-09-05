require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const kitchenRoutes = require("./routes/kitchenRoutes");


const app = express();
// Behind nginx: trust the first proxy so req.ip is the real client, not nginx.
app.set("trust proxy", 1);
app.use(helmet());
const restaurantRoutes = require("./routes/restaurantRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const tableRoutes = require("./routes/tableRoutes");
const customerRoutes = require("./routes/customerRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");
const authRoutes = require("./routes/authRoutes");
const errorHandler = require("./middleware/errorHandler");
const authMiddleware = require("./middleware/authMiddleware");
const roleMiddleware = require("./middleware/roleMiddleware");
/*
|--------------------------------------------------------------------------
| Database Connection
|--------------------------------------------------------------------------
*/

const db = require("./config/db");
const { runSyncSchema } = require("./migrations/syncColumns");

// Add the sync columns (uuid / deleted_at / synced_at / updated_at) after the
// inline table migrations below have had a moment to create their tables.
// Idempotent and self-skipping, so the exact delay is not critical.
setTimeout(() => {
    runSyncSchema().catch((err) =>
        console.error("Sync schema migration error:", err.message)
    );
}, 4000);

db.query(`
    CREATE TABLE IF NOT EXISTS charges (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id    INT NOT NULL,
        charge_name      VARCHAR(100) NOT NULL,
        description      TEXT DEFAULT NULL,
        charge_type      VARCHAR(20) NOT NULL DEFAULT 'Fixed',
        amount           DECIMAL(10,2) NOT NULL DEFAULT 0,
        applies_dinein   TINYINT(1) DEFAULT 1,
        applies_takeaway TINYINT(1) DEFAULT 0,
        applies_delivery TINYINT(1) DEFAULT 0,
        apply_tax        TINYINT(1) DEFAULT 1,
        status           VARCHAR(10) DEFAULT 'Active',
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) console.error("Charges table migration error:", err.message);
    else console.log("Charges table ready.");
});

db.query(`
    CREATE TABLE IF NOT EXISTS restaurant_networks (
        restaurant_id INT PRIMARY KEY,
        wan_ip        VARCHAR(64) DEFAULT NULL,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) console.error("restaurant_networks table migration error:", err.message);
    else console.log("restaurant_networks table ready.");
});

// Cloud side: when a restaurant last pushed (drives the admin "last synced" badge).
db.query(`
    CREATE TABLE IF NOT EXISTS sync_status (
        restaurant_uuid CHAR(36) PRIMARY KEY,
        last_sync_at    TIMESTAMP NULL DEFAULT NULL
    )
`, (err) => {
    if (err) console.error("sync_status table migration error:", err.message);
});

// Local side: per-table high-water mark for pulling down-tables from the cloud.
db.query(`
    CREATE TABLE IF NOT EXISTS sync_state (
        table_name     VARCHAR(64) PRIMARY KEY,
        last_pulled_at TIMESTAMP NULL DEFAULT NULL
    )
`, (err) => {
    if (err) console.error("sync_state table migration error:", err.message);
});

// Local side: this machine's activation state (restaurant identity + sync key
// obtained from the cloud on first run). Single row (id = 1).
db.query(`
    CREATE TABLE IF NOT EXISTS activation (
        id              TINYINT PRIMARY KEY,
        machine_id      VARCHAR(128) DEFAULT NULL,
        restaurant_uuid CHAR(36) DEFAULT NULL,
        sync_key        VARCHAR(80) DEFAULT NULL,
        activated_at    TIMESTAMP NULL DEFAULT NULL
    )
`, (err) => {
    if (err) console.error("activation table migration error:", err.message);
});

// Cloud side: per-restaurant activation key + machine sync credential.
db.query(`
    CREATE TABLE IF NOT EXISTS restaurant_activations (
        restaurant_id  INT PRIMARY KEY,
        activation_key VARCHAR(32) UNIQUE NOT NULL,
        sync_key       VARCHAR(80) NOT NULL,
        machine_id     VARCHAR(128) DEFAULT NULL,
        activated_at   TIMESTAMP NULL DEFAULT NULL,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) console.error("restaurant_activations table migration error:", err.message);
});

db.query(`
    CREATE TABLE IF NOT EXISTS bill_formats (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id        INT NOT NULL UNIQUE,
        paper_size           VARCHAR(20) DEFAULT 'thermal',
        show_logo            TINYINT(1) DEFAULT 0,
        show_restaurant_name TINYINT(1) DEFAULT 1,
        show_address         TINYINT(1) DEFAULT 1,
        show_phone           TINYINT(1) DEFAULT 1,
        show_email           TINYINT(1) DEFAULT 0,
        show_gst             TINYINT(1) DEFAULT 1,
        show_fssai           TINYINT(1) DEFAULT 0,
        show_order_number    TINYINT(1) DEFAULT 1,
        show_date            TINYINT(1) DEFAULT 1,
        show_time            TINYINT(1) DEFAULT 1,
        show_table_name      TINYINT(1) DEFAULT 1,
        show_customer_name   TINYINT(1) DEFAULT 0,
        show_waiter_name     TINYINT(1) DEFAULT 0,
        show_cashier_name    TINYINT(1) DEFAULT 0,
        show_payment_method  TINYINT(1) DEFAULT 1,
        show_item_qty        TINYINT(1) DEFAULT 1,
        show_item_price      TINYINT(1) DEFAULT 1,
        show_subtotal        TINYINT(1) DEFAULT 1,
        show_tax             TINYINT(1) DEFAULT 1,
        show_service_charge  TINYINT(1) DEFAULT 1,
        show_charges         TINYINT(1) DEFAULT 1,
        show_grand_total     TINYINT(1) DEFAULT 1,
        header_title         VARCHAR(100) DEFAULT NULL,
        footer_text          VARCHAR(255) DEFAULT 'Thank you! Visit again.',
        terms_text           TEXT DEFAULT NULL,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_bill_format_restaurant
            FOREIGN KEY (restaurant_id)
            REFERENCES restaurants(id)
            ON DELETE CASCADE
    )
`, (err) => {
    if (err) console.error("Bill formats table migration error:", err.message);
    else console.log("Bill formats table ready.");
});

db.query(`
    CREATE TABLE IF NOT EXISTS kitchen_formats (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id        INT NOT NULL UNIQUE,
        paper_size           VARCHAR(20) DEFAULT 'thermal',
        show_logo            TINYINT(1) DEFAULT 0,
        show_restaurant_name TINYINT(1) DEFAULT 1,
        show_address         TINYINT(1) DEFAULT 0,
        show_phone           TINYINT(1) DEFAULT 0,
        show_order_number    TINYINT(1) DEFAULT 1,
        show_date            TINYINT(1) DEFAULT 1,
        show_time            TINYINT(1) DEFAULT 1,
        show_order_type      TINYINT(1) DEFAULT 1,
        show_table_name      TINYINT(1) DEFAULT 1,
        show_customer_name   TINYINT(1) DEFAULT 0,
        show_waiter_name     TINYINT(1) DEFAULT 1,
        show_cashier_name    TINYINT(1) DEFAULT 0,
        show_item_qty        TINYINT(1) DEFAULT 1,
        show_item_name       TINYINT(1) DEFAULT 1,
        show_item_notes      TINYINT(1) DEFAULT 1,
        show_item_category   TINYINT(1) DEFAULT 0,
        header_title         VARCHAR(100) DEFAULT 'KITCHEN ORDER TICKET',
        footer_text          VARCHAR(255) DEFAULT 'Please prepare carefully.',
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_kitchen_format_restaurant
            FOREIGN KEY (restaurant_id)
            REFERENCES restaurants(id)
            ON DELETE CASCADE
    )
`, (err) => {
    if (err) console.error("Kitchen formats table migration error:", err.message);
    else console.log("Kitchen formats table ready.");
});

// Which printer setup this restaurant runs (Admin → Settings). See
// backend/models/printerSettingModel.js for what each mode means.
db.query(`
    CREATE TABLE IF NOT EXISTS printer_settings (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id   INT NOT NULL UNIQUE,
        printer_mode    VARCHAR(30) DEFAULT 'dual_printer',
        cashier_printer VARCHAR(150) DEFAULT NULL,
        kitchen_printer VARCHAR(150) DEFAULT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_printer_setting_restaurant
            FOREIGN KEY (restaurant_id)
            REFERENCES restaurants(id)
            ON DELETE CASCADE
    )
`, (err) => {
    if (err) console.error("Printer settings table migration error:", err.message);
    else console.log("Printer settings table ready.");
});

// settings.restaurant_id must be UNIQUE or saveRestaurantSettings' upsert can
// never take its UPDATE branch — every save inserts another row and reads come
// back stale, so an admin's change to (say) the GST rate silently does nothing.
// See migrations/009_settings_unique_restaurant.sql.
db.query(`
    SELECT INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'settings'
      AND COLUMN_NAME = 'restaurant_id'
      AND NON_UNIQUE = 0
`, (err, rows) => {
    if (err) {
        console.error("Settings unique-key check error:", err.message);
        return;
    }
    if (rows && rows.length) {
        console.log("Settings restaurant_id unique key ready.");
        return;
    }
    // Keep the most recently written row per restaurant — what the admin last
    // intended — then constrain the table so this can't recur.
    db.query(
        `DELETE s1 FROM settings s1
         INNER JOIN settings s2
             ON s1.restaurant_id = s2.restaurant_id AND s1.id < s2.id`,
        (dedupeErr, result) => {
            if (dedupeErr) {
                console.error("Settings dedupe error:", dedupeErr.message);
                return;
            }
            if (result && result.affectedRows) {
                console.log(`Settings: removed ${result.affectedRows} duplicate row(s).`);
            }
            db.query(
                "ALTER TABLE settings ADD UNIQUE KEY uq_settings_restaurant (restaurant_id)",
                (alterErr) => {
                    if (alterErr) console.error("Settings unique-key migration error:", alterErr.message);
                    else console.log("Settings restaurant_id unique key added.");
                }
            );
        }
    );
});

// Per-bill charges, itemised against the order that carries them. See
// migrations/008_order_charges.sql for why they are stored rather than living
// only on the receipt.
db.query(`
    CREATE TABLE IF NOT EXISTS order_charges (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        order_id    INT NOT NULL,
        charge_name VARCHAR(100) NOT NULL,
        amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_order_charges_order (order_id),
        CONSTRAINT fk_order_charges_order
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
`, (err) => {
    if (err) console.error("order_charges table migration error:", err.message);
    else console.log("Order charges table ready.");
});

// orders.charges_total — the rolled-up per-bill charges, so grand_total is the
// whole amount owed and no report has to join to find it.
db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'charges_total'
`, (err, rows) => {
    if (err) {
        console.error("orders.charges_total check error:", err.message);
        return;
    }
    if (rows && rows.length) {
        console.log("Orders charges_total column ready.");
        return;
    }
    db.query(
        `ALTER TABLE orders
         ADD COLUMN charges_total DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER service_charge`,
        (alterErr) => {
            if (alterErr) console.error("orders.charges_total migration error:", alterErr.message);
            else console.log("Orders charges_total column added.");
        }
    );
});

db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'categories'
      AND COLUMN_NAME IN ('start_time', 'end_time')
`, (err, rows) => {
    if (err) {
        console.error("Categories timing migration check error:", err.message);
        return;
    }

    const existingColumns = new Set(
        (rows || []).map((row) => row.COLUMN_NAME)
    );
    const alterClauses = [];

    if (!existingColumns.has("start_time")) {
        alterClauses.push("ADD COLUMN start_time TIME NULL AFTER status");
    }

    if (!existingColumns.has("end_time")) {
        alterClauses.push("ADD COLUMN end_time TIME NULL AFTER start_time");
    }

    if (alterClauses.length === 0) {
        console.log("Categories timing columns ready.");
        return;
    }

    db.query(
        `ALTER TABLE categories ${alterClauses.join(", ")}`,
        (alterErr) => {
            if (alterErr) {
                console.error("Categories timing migration error:", alterErr.message);
            } else {
                console.log("Categories timing columns ready.");
            }
        }
    );
});

db.query(`
    SELECT DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'restaurants'
      AND COLUMN_NAME = 'logo'
`, (err, rows) => {
    if (err) {
        console.error("Restaurants logo column check error:", err.message);
        return;
    }
    const currentType = (rows && rows[0]?.DATA_TYPE) ? rows[0].DATA_TYPE.toLowerCase() : "";
    if (currentType !== "longtext" && currentType !== "mediumtext") {
        db.query(`ALTER TABLE restaurants MODIFY COLUMN logo LONGTEXT DEFAULT NULL`, (alterErr) => {
            if (alterErr) console.error("Restaurants logo column alter error:", alterErr.message);
            else console.log("Restaurants logo column upgraded to LONGTEXT.");
        });
    } else {
        console.log("Restaurants logo column ready.");
    }
});

// ── Settings table: add missing columns if they don't exist ─────
db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'settings'
      AND COLUMN_NAME IN ('time_zone', 'opening_time', 'closing_time', 'restaurant_status')
`, (err, rows) => {
    if (err) { console.error("Settings column check error:", err.message); return; }
    const existing = new Set((rows || []).map((r) => r.COLUMN_NAME));
    const clauses = [];
    if (!existing.has("time_zone"))         clauses.push("ADD COLUMN time_zone VARCHAR(50) DEFAULT 'Asia/Kolkata' AFTER invoice_footer");
    if (!existing.has("opening_time"))      clauses.push("ADD COLUMN opening_time TIME NULL AFTER time_zone");
    if (!existing.has("closing_time"))      clauses.push("ADD COLUMN closing_time TIME NULL AFTER opening_time");
    if (!existing.has("restaurant_status")) clauses.push("ADD COLUMN restaurant_status VARCHAR(10) DEFAULT 'Open' AFTER closing_time");
    if (clauses.length === 0) { console.log("Settings columns ready."); return; }
    db.query(`ALTER TABLE settings ${clauses.join(", ")}`, (e) => {
        if (e) console.error("Settings column migration error:", e.message);
        else console.log("Settings columns added.");
    });
});

// ── Payment settings table ─────────────────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS payment_settings (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id   INT NOT NULL UNIQUE,
        cash_enabled    TINYINT(1) DEFAULT 1,
        upi_enabled     TINYINT(1) DEFAULT 1,
        card_enabled    TINYINT(1) DEFAULT 1,
        other_enabled   TINYINT(1) DEFAULT 0,
        upi_id          VARCHAR(120) DEFAULT NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_payment_settings_restaurant
            FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    )
`, (err) => {
    if (err) console.error("Payment settings table migration error:", err.message);
    else console.log("Payment settings table ready.");
});

// ── Security settings table ────────────────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS security_settings (
        id                          INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id               INT NOT NULL UNIQUE,
        session_timeout_hours       INT DEFAULT 8,
        discount_approval           TINYINT(1) DEFAULT 0,
        refund_approval             TINYINT(1) DEFAULT 0,
        cancel_order_approval       TINYINT(1) DEFAULT 0,
        menu_price_change_approval  TINYINT(1) DEFAULT 0,
        created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_security_settings_restaurant
            FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    )
`, (err) => {
    if (err) console.error("Security settings table migration error:", err.message);
    else console.log("Security settings table ready.");
});

// ── Seed default permissions if the table is empty ─────────────
db.query("SELECT COUNT(*) AS cnt FROM permissions", (err, rows) => {
    if (err) return;
    if (rows[0].cnt > 0) return;
    const defaults = [
        ["View Orders", "Orders"], ["Create Orders", "Orders"], ["Edit Orders", "Orders"], ["Cancel Orders", "Orders"],
        ["View Tables", "Tables"], ["Manage Tables", "Tables"],
        ["View Payments", "Payments"], ["Process Payments", "Payments"], ["Refund Payment", "Payments"],
        ["View Reports", "Reports"], ["Export Reports", "Reports"],
        ["View Menu", "Menu"], ["Manage Menu", "Menu"],
        ["View Employees", "Employees"], ["Manage Employees", "Employees"],
        ["View Categories", "Categories"], ["Manage Categories", "Categories"],
        ["View Customers", "Customers"], ["Manage Customers", "Customers"],
        ["Manage Settings", "Settings"], ["Manage Printer Settings", "Settings"],
        ["View Kitchen Display", "Kitchen"], ["Manage Kitchen", "Kitchen"],
        ["View Charges", "Charges"], ["Manage Charges", "Charges"],
        ["View Billing Format", "Billing"], ["Manage Billing Format", "Billing"]
    ];
    db.query("INSERT INTO permissions (permission_name, module_name) VALUES ?", [defaults], (e) => {
        if (e) console.error("Permission seed error:", e.message);
        else console.log("Default permissions seeded.");
    });
});

// ── Seed default roles for restaurants that have none ───────────
db.query(`
    SELECT r.id FROM restaurants r
    LEFT JOIN roles ro ON ro.restaurant_id = r.id
    WHERE ro.id IS NULL AND r.deleted_at IS NULL
`, (err, rows) => {
    if (err || !rows || rows.length === 0) return;
    const roleNames = ["Admin", "Cashier", "Waiter", "Kitchen"];
    rows.forEach(({ id }) => {
        const vals = roleNames.map((name) => [id, name, `${name} role`]);
        db.query("INSERT INTO roles (restaurant_id, role_name, description) VALUES ?", [vals], (e) => {
            if (e) console.error(`Role seed error for restaurant ${id}:`, e.message);
        });
    });
    console.log("Default roles seeded for restaurants without roles.");
});

/*
|--------------------------------------------------------------------------
| Global Middleware
|--------------------------------------------------------------------------
| IMPORTANT:
| CORS and express.json() must be registered BEFORE all API routes.
*/

app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        // Capacitor app origins — Android uses https://localhost with
        // androidScheme "https", iOS uses capacitor://localhost.
        "https://localhost",
        "capacitor://localhost"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve the built React app so ONE machine (the cashier PC) hosts both the UI
// and the API on http://<lan-ip>:5000. On the cloud, nginx serves the build and
// only proxies /api here, so this static layer is dormant there — harmless.
//
// In development the frontend runs separately on :3000, so set SERVE_CLIENT=false
// in backend/.env to keep :5000 API-only (no stale login page served here).
const buildDir = path.join(__dirname, "..", "build");
const serveClient = process.env.SERVE_CLIENT !== "false";
if (serveClient) {
    app.use(express.static(buildDir));
}

const adminRoutes = require("./routes/adminRoutes");



/*
|--------------------------------------------------------------------------
| Import Routes
|--------------------------------------------------------------------------
*/
const superAdminRoutes = require("./routes/superAdminRoutes");
const menuRoutes = require("./routes/menuRoutes");
const chargeRoutes = require("./routes/chargeRoutes");
const billingFormatRoutes = require("./routes/billingFormatRoutes");
const systemRoutes = require("./routes/systemRoutes");
const syncRoutes = require("./routes/syncRoutes");
const activationRoutes = require("./routes/activationRoutes");
const kitchenFormatRoutes = require("./routes/kitchenFormatRoutes");
const printerSettingRoutes = require("./routes/printerSettingRoutes");
const printRoutes = require("./routes/printRoutes");
const settingsRoutes = require("./routes/settingsRoutes");

/*
|--------------------------------------------------------------------------
| Register Routes
|--------------------------------------------------------------------------
*/


// Throttle login attempts — the API is reachable from every phone on the WiFi
// and (in the cloud tier) the public internet.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts. Try again later." }
});
app.use("/api/auth/login", authLimiter);

app.use("/api/super-admin", superAdminRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/charges", chargeRoutes);
app.use("/api/billing", billingFormatRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/activate", activationRoutes);
app.use("/api/kitchen-format", kitchenFormatRoutes);
app.use("/api/printer-settings", printerSettingRoutes);
app.use("/api/print", printRoutes);
app.use("/api/settings", settingsRoutes);
/*
|--------------------------------------------------------------------------
| Test Route
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {

    res.json({
        message: "InWallz Billing Backend Running"
    });

});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/


app.get("/test", (req, res) => {
    res.json({
        message: "Test route working"
    });
});

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
| Hit by the app on launch to decide whether the device is on the restaurant
| network. Deliberately unauthenticated and cheap — reaching it at all is the
| answer, so it must not touch the database.
*/

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        service: "inwallz-billing"
    });
});

// SPA fallback: any non-API GET returns index.html so React Router deep links
// (e.g. /cashier) work on a refresh. Must come after all API routes. Written as
// middleware rather than app.get("*") for Express 5 path-matching compatibility.
app.use((req, res, next) => {
    if (serveClient && req.method === "GET" && !req.path.startsWith("/api")) {
        return res.sendFile(path.join(buildDir, "index.html"), (err) => {
            if (err) next();
        });
    }
    next();
});

// Global Error Handler (must be registered last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server Running on Port ${PORT}`);
    // Only the local node (SYNC_ROLE=local) runs the sync worker; the cloud
    // just exposes the /api/sync endpoints.
    require("./sync/syncWorker").start();
});
