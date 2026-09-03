const express = require("express");
const router = express.Router();

const systemController = require("../controllers/systemController");
const authMiddleware = require("../middleware/authMiddleware");

// Server LAN IP (for waiter-phone setup)
router.get("/server-ip", systemController.getServerIp);

// Same-network enforcement (cloud model): cashier registers the restaurant's
// WAN IP, waiter checks it is on that same network.
router.post("/register-network", authMiddleware, systemController.registerNetwork);
router.get("/network-status", authMiddleware, systemController.networkStatus);

// Printers installed on the server PC (the till, in exe mode) — used by the
// cashier's Printer page to offer the real printer names.
router.get("/printers", authMiddleware, systemController.getPrinters);

// Settings
router.get("/settings/:restaurantId", systemController.getSettings);

router.post("/settings", systemController.createSettings);

router.put("/settings/:restaurantId", systemController.updateSettings);

module.exports = router;
// Roles
router.get("/roles/:restaurantId", systemController.getRoles);

router.post("/roles", systemController.createRole);

// Permissions
router.get("/permissions", systemController.getPermissions);

router.put("/roles/:roleId/permissions", systemController.assignPermissions);
// Activity Logs
router.post("/activity-logs", systemController.createActivityLog);

router.get(
    "/activity-logs/:restaurantId",
    systemController.getActivityLogs
);