const express = require("express");
const router = express.Router();

const systemController = require("../controllers/systemController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const sameTenant = require("../middleware/tenantMiddleware");

/*
| Server LAN IP (for waiter-phone setup).
|
| The ONLY deliberately public route here: the cashier reads the address off
| this screen before anyone has logged in, and it leaks nothing but the till's
| own private-LAN address. Everything below it requires a staff token.
*/
router.get("/server-ip", systemController.getServerIp);

router.use(authMiddleware);

// Same-network enforcement (cloud model): cashier registers the restaurant's
// WAN IP, waiter checks it is on that same network.
router.post("/register-network", systemController.registerNetwork);
router.get("/network-status", systemController.networkStatus);

// Printers installed on the server PC (the till, in exe mode) — used by the
// cashier's Printer page to offer the real printer names.
router.get("/printers", systemController.getPrinters);

// Settings. `sameTenant` rejects a :restaurantId that is not the caller's own,
// so the id in the URL can never be used to reach across restaurants.
router.get("/settings/:restaurantId", sameTenant, systemController.getSettings);
router.post("/settings", roleMiddleware(["super_admin", "admin"]), systemController.createSettings);
router.put("/settings/:restaurantId", sameTenant, roleMiddleware(["super_admin", "admin"]), systemController.updateSettings);

// Roles
router.get("/roles/:restaurantId", sameTenant, systemController.getRoles);
router.post("/roles", roleMiddleware(["super_admin", "admin"]), systemController.createRole);

// Permissions
router.get("/permissions", systemController.getPermissions);
router.put(
    "/roles/:roleId/permissions",
    roleMiddleware(["super_admin", "admin"]),
    systemController.assignPermissions
);

// Activity Logs
router.post("/activity-logs", systemController.createActivityLog);
router.get("/activity-logs/:restaurantId", sameTenant, systemController.getActivityLogs);

module.exports = router;
