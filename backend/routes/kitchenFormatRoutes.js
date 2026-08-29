const express = require("express");
const router = express.Router();
const kitchenFormatController = require("../controllers/kitchenFormatController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Authenticated restaurant staff (admin, cashier, waiter) can read kitchen template
router.get("/", kitchenFormatController.getFormat);

// Admin-only updates
router.put("/", roleMiddleware(["admin"]), kitchenFormatController.updateFormat);

module.exports = router;
