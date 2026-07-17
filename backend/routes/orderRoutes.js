const express = require("express");

const router = express.Router();

const orderController = require("../controllers/orderController");

// Create Order
router.post("/", orderController.createOrder);

// Get All Orders
router.get("/", orderController.getOrders);

// Running Orders
router.get("/running", orderController.getRunningOrders);

// Order Items
router.get("/:id/items", orderController.getOrderDetails);

router.put("/:id", orderController.updateOrder);

router.delete("/:id", orderController.cancelOrder);

// Get Order By ID
router.get("/:id", orderController.getOrderById);



module.exports = router;