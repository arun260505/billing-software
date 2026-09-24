const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// ── 1. Restaurant Settings ─────────────────────────────────────
router.get("/restaurant", settingsController.getRestaurant);
router.put("/restaurant", roleMiddleware(["admin"]), settingsController.saveRestaurant);

// The owner's front-desk discount rule (read via GET /restaurant).
router.put("/discounts", roleMiddleware(["admin"]), settingsController.saveDiscounts);

// Salon bills: printer or not, and the WhatsApp message (read via GET /restaurant).
router.put("/whatsapp", roleMiddleware(["admin"]), settingsController.saveWhatsApp);

// POS: tap-to-add menu cards (hide + / stepper on the card)
router.put("/menu", roleMiddleware(["admin"]), settingsController.saveMenu);

// ── 2. Payment Settings ────────────────────────────────────────
router.get("/payments", settingsController.getPayments);
router.put("/payments", roleMiddleware(["admin"]), settingsController.savePayments);

// ── 3. Security Settings ───────────────────────────────────────
router.get("/security", settingsController.getSecurity);
router.put("/security", roleMiddleware(["admin"]), settingsController.saveSecurity);

// ── 3b. Order Number Format ────────────────────────────────────
router.get("/order-number-format", settingsController.getOrderNumberFormat);
router.put("/order-number-format", roleMiddleware(["admin"]), settingsController.saveOrderNumberFormat);

// ── 4. Staff & Permissions ─────────────────────────────────────
router.get("/roles", settingsController.getRoles);
router.get("/permissions", settingsController.getPermissions);
router.get("/roles/:roleId/permissions", settingsController.getRolePermissions);
router.put("/roles/:roleId/permissions", roleMiddleware(["admin"]), settingsController.saveRolePermissions);

// ── 5. Change Password ─────────────────────────────────────────
router.put("/change-password", roleMiddleware(["admin"]), settingsController.changePassword);

module.exports = router;
