const express = require("express");

const router = express.Router();

const adminController =
require("../controllers/adminController");

// Authentication middleware will be added later
router.get(
    "/dashboard",
    adminController.getDashboard
);

module.exports = router;