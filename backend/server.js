require("dotenv").config();

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

app.use(express.json());
const adminRoutes = require("./routes/adminRoutes");



/*
|--------------------------------------------------------------------------
| Import Routes
|--------------------------------------------------------------------------
*/
const superAdminRoutes = require("./routes/superAdminRoutes");
const menuRoutes = require("./routes/menuRoutes");
const chargeRoutes = require("./routes/chargeRoutes");



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

// Global Error Handler (must be registered last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server Running on Port ${PORT}`);
});
