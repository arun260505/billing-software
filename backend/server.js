require("dotenv").config();
const os = require("os");

// ── mDNS discovery: browse for the Cashier's local service ──────
// The cashierNetworkServer.js publishes "_inwallz-cashier._tcp".
// This backend acts as a bridge: the Waiter browser calls
// GET /api/discover-cashier and gets the Cashier's IP back.
const { Bonjour } = require("bonjour-service");
const bonjourBrowser = new Bonjour();
let discoveredCashier = null;   // { ip, port, name, seenAt }

// Tracks whether an actual Cashier user is signed in on the web app.
// The Cashier dashboard sends a heartbeat every few seconds while logged
// in (via POST /api/cashier/heartbeat). Discovery only reports the Cashier
// as "found" while a Cashier user is actively signed in, so logging out
// makes the Waiter see the Cashier as offline.
let cashierOnline = false;
let cashierOnlineAt = 0;
const CASHIER_HEARTBEAT_TTL = 15000;   // ms before a missing heartbeat = offline

const cashierBrowser = bonjourBrowser.find({ type: "inwallz-cashier" });
cashierBrowser.on("up", (service) => {
    // Prefer an explicit IPv4 address; fall back to .host
    const ipv4 = (service.addresses || []).find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a));
    discoveredCashier = {
        ip:     ipv4 || service.host,
        port:   service.port,
        name:   service.name,
        seenAt: Date.now(),
    };
    console.log(`🟢 Cashier discovered on LAN: ${discoveredCashier.ip}:${discoveredCashier.port}`);
});
cashierBrowser.on("down", () => {
    discoveredCashier = null;
    console.log("🔴 Cashier went offline (mDNS)");
});

const express = require("express");
const cors = require("cors");
const kitchenRoutes = require("./routes/kitchenRoutes");


const app = express();
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
        "http://localhost:3002"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
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



/*
|--------------------------------------------------------------------------
| Register Routes
|--------------------------------------------------------------------------
*/


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
| Local IP Route
|--------------------------------------------------------------------------
| Returns the server machine's first non-loopback IPv4 address.
| Shown on the Cashier Dashboard as a visual reference.
*/

app.get("/api/local-ip", (req, res) => {
    const interfaces = os.networkInterfaces();
    let localIP = "127.0.0.1";
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                localIP = iface.address;
                break;
            }
        }
        if (localIP !== "127.0.0.1") break;
    }
    res.json({ success: true, ip: localIP });
});

/*
|--------------------------------------------------------------------------
| Cashier Discovery Route
|--------------------------------------------------------------------------
| Returns the mDNS-discovered Cashier IP so the Waiter browser can
| auto-connect without manual IP entry.
| The Cashier must be running cashierNetworkServer.js which publishes
| the _inwallz-cashier._tcp mDNS service.
*/

// Returns the server machine's first non-loopback IPv4 address.
// Falls back to "127.0.0.1" if none can be determined.
function getLANIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "127.0.0.1";
}

// Actively checks whether the Cashier network service (port 5001) is
// reachable at the given IP. Used as a fallback for discovery so the
// Waiter can connect even when the Cashier runs on the SAME machine as
// this backend (where mDNS self-discovery often fails on Windows).
function cashierReachableAt(ip, timeoutMs = 2000) {
    return new Promise((resolve) => {
        const http = require("http");
        const req = http.get(`http://${ip}:5001/connection-check`, { timeout: timeoutMs }, (res) => {
            let body = "";
            res.on("data", (c) => body += c);
            res.on("end", () => {
                try {
                    const json = JSON.parse(body);
                    resolve(!!res.complete && json.status === "online");
                } catch {
                    resolve(false);
                }
            });
        });
        req.on("timeout", () => { req.destroy(); resolve(false); });
        req.on("error", () => resolve(false));
    });
}

app.get("/api/discover-cashier", async (req, res) => {
    // A Cashier must be actively signed in (heartbeat recent) before the
    // Waiter is allowed to see them as available. Logging out stops the
    // heartbeat, which after a short timeout makes discovery return "not found".
    const signedIn = cashierOnline && (Date.now() - cashierOnlineAt) < CASHIER_HEARTBEAT_TTL;
    if (!signedIn) {
        return res.json({ found: false });
    }
    if (discoveredCashier) {
        // Stale guard: if we haven't seen the cashier for >30 s, treat as gone.
        const ageMs = Date.now() - (discoveredCashier.seenAt || 0);
        if (ageMs < 30000) {
            return res.json({ found: true, ip: discoveredCashier.ip, port: discoveredCashier.port });
        }
        discoveredCashier = null;
    }
    // Fallback: if mDNS found nothing (e.g. Cashier and this backend are on the
    // same machine), check whether the Cashier service is running on this same
    // machine's LAN IP and report it directly.
    const lanIP = getLANIP();
    if (lanIP !== "127.0.0.1") {
        const online = await cashierReachableAt(lanIP);
        if (online) {
            return res.json({ found: true, ip: lanIP, port: 5001 });
        }
    }
    res.json({ found: false });
});

// Cashier heartbeat: the Cashier dashboard calls this every few seconds
// while signed in to signal it is online. Requires a valid cashier JWT.
app.post("/api/cashier/heartbeat", authMiddleware, roleMiddleware(["cashier"]), (req, res) => {
    cashierOnline = true;
    cashierOnlineAt = Date.now();
    res.json({ success: true, online: true });
});

// Cashier logout: marks the cashier offline immediately so waiters stop
// seeing them as available.
app.post("/api/cashier/logout", (req, res) => {
    cashierOnline = false;
    cashierOnlineAt = 0;
    res.json({ success: true, online: false });
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

// Global Error Handler (must be registered last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server Running on Port ${PORT}`);
});
