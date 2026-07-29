const express = require("express");
const router = express.Router();

const kitchenController = require("../controllers/kitchenController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Kitchen display + status updates: kitchen staff (admin may oversee).
router.use(authMiddleware);
router.use(roleMiddleware(["kitchen", "admin"]));

router.get("/orders", kitchenController.getKitchenOrders);
router.get("/orders/:id", kitchenController.getKitchenOrderItems);
router.put("/orders/:id", kitchenController.updateKitchenStatus);

module.exports = router;
