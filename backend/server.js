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
const buildDir = path.join(__dirname, "..", "build");
app.use(express.static(buildDir));

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
const kitchenFormatRoutes = require("./routes/kitchenFormatRoutes");



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
app.use("/api/kitchen-format", kitchenFormatRoutes);
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
    if (req.method === "GET" && !req.path.startsWith("/api")) {
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
});
