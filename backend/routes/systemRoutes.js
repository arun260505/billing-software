const express = require("express");
const router = express.Router();

const systemController = require("../controllers/systemController");

// Server LAN IP (for waiter-phone setup)
router.get("/server-ip", systemController.getServerIp);

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