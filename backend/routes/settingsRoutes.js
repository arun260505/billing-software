const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// ── 1. Restaurant Settings ─────────────────────────────────────
router.get("/restaurant", settingsController.getRestaurant);
router.put("/restaurant", roleMiddleware(["admin"]), settingsController.saveRestaurant);

// ── 2. Payment Settings ────────────────────────────────────────
router.get("/payments", settingsController.getPayments);
router.put("/payments", roleMiddleware(["admin"]), settingsController.savePayments);

// ── 3. Security Settings ───────────────────────────────────────
router.get("/security", settingsController.getSecurity);
router.put("/security", roleMiddleware(["admin"]), settingsController.saveSecurity);

// ── 4. Staff & Permissions ─────────────────────────────────────
router.get("/roles", settingsController.getRoles);
router.get("/permissions", settingsController.getPermissions);
router.get("/roles/:roleId/permissions", settingsController.getRolePermissions);
router.put("/roles/:roleId/permissions", roleMiddleware(["admin"]), settingsController.saveRolePermissions);

// ── 5. Change Password ─────────────────────────────────────────
router.put("/change-password", roleMiddleware(["admin"]), settingsController.changePassword);

module.exports = router;
