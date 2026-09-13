const express = require("express");
const router = express.Router();

const kitchenController = require("../controllers/kitchenController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { restaurantOnly } = require("../middleware/businessTypeMiddleware");

// Kitchen display + status updates: kitchen staff (admin may oversee). A salon
// has no kitchen.
router.use(authMiddleware);
router.use(restaurantOnly);
router.use(roleMiddleware(["kitchen", "admin"]));

router.get("/tickets", kitchenController.getKitchenTickets);
router.get("/tables", kitchenController.getKitchenByTable);
router.put("/item/:itemId/serve", kitchenController.serveItem);
router.get("/orders", kitchenController.getKitchenOrders);
router.get("/orders/:id", kitchenController.getKitchenOrderItems);
router.put("/orders/:id", kitchenController.updateKitchenStatus);

module.exports = router;
