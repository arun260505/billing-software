const express = require("express");
const router = express.Router();
const billingFormatController = require("../controllers/billingFormatController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Authenticated restaurant staff (admin, cashier, waiter) can read format and restaurant branding
router.get("/format", billingFormatController.getFormat);

// Admin-only updates
router.put("/format", roleMiddleware(["admin"]), billingFormatController.updateFormat);
router.put("/restaurant", roleMiddleware(["admin"]), billingFormatController.updateRestaurant);

module.exports = router;
