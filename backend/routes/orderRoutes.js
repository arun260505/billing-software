const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

const staff = roleMiddleware(["admin", "cashier", "waiter"]);
const takers = roleMiddleware(["cashier", "waiter"]);

// Reads. NOTE: static/more-specific paths must be registered before "/:id".
router.get("/", staff, orderController.getAllOrders);
router.get("/running", staff, orderController.getRunningOrders);
router.get("/table/:tableId/items", staff, orderController.getTableActiveItems);
router.post("/table/:tableId/settle", roleMiddleware(["admin", "cashier"]), orderController.settleTable);
router.get("/today-count", staff, orderController.getTodaysOrderCount);
router.get("/:id/items", staff, orderController.getOrderDetails);
router.get("/:id", staff, orderController.getOrderById);

// Waiter marks a served order (before the generic /:id routes).
router.put("/:id/serve", roleMiddleware(["admin", "waiter", "cashier"]), orderController.markServed);

// Writes.
router.post("/", takers, orderController.createOrder);
router.put("/:id", takers, orderController.updateOrder);
router.delete("/:id", staff, orderController.cancelOrder);   // soft cancel

module.exports = router;
