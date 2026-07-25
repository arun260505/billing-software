const express = require("express");
const router = express.Router();

const kitchenController = require("../controllers/kitchenController");

// Get all kitchen orders
router.get("/orders", kitchenController.getKitchenOrders);

// Get one kitchen order items
router.get("/orders/:id", kitchenController.getKitchenOrderItems);

// Update kitchen status
router.put("/orders/:id", kitchenController.updateKitchenStatus);

module.exports = router;