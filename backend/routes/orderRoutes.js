const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Reads: admin oversight + front-of-house staff.
router.get("/", roleMiddleware(["admin", "cashier", "waiter"]), orderController.getAllOrders);
router.get("/:id", roleMiddleware(["admin", "cashier", "waiter"]), orderController.getOrderById);

// Create: cashier/waiter take orders.
router.post("/", roleMiddleware(["cashier", "waiter"]), orderController.createOrder);

// Delete/void: admin only.
router.delete("/:id", roleMiddleware(["admin"]), orderController.deleteOrder);

module.exports = router;
