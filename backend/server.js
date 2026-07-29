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
const authRoutes = require("./routes/authRoutes");
const errorHandler = require("./middleware/errorHandler");
/*
|--------------------------------------------------------------------------
| Database Connection
|--------------------------------------------------------------------------
*/

require("./config/db");

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
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
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