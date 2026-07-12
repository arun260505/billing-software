require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const superAdminRoutes = require("./routes/superAdminRoutes");

app.use("/api/super-admin", superAdminRoutes);

require("./config/db");

app.use(cors());
app.use(express.json());

const authRoutes = require("./routes/authRoutes");

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "InWallz Billing Backend Running"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server Running on Port ${PORT}`);
});