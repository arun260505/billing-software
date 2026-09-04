const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { requireApproval } = require("../middleware/approvalMiddleware");

router.use(authMiddleware);

const staff = roleMiddleware(["admin", "cashier", "waiter"]);
const takers = roleMiddleware(["cashier", "waiter"]);
// Correcting an already-settled bill touches recorded money, so it stays with
// the cashier who rang it up and the admin above them.
const billing = roleMiddleware(["admin", "cashier"]);

// Reads. NOTE: static/more-specific paths must be registered before "/:id".
router.get("/", staff, orderController.getAllOrders);
router.get("/running", staff, orderController.getRunningOrders);
router.get("/table/:tableId/items", staff, orderController.getTableActiveItems);
router.put("/table/:tableId/serve", staff, orderController.markTableServed);
router.put("/item/:itemId/serve", staff, orderController.markItemServed);
router.put("/item/:itemId/qty", staff, orderController.setItemQuantity);   // edit bill quantity
router.delete("/item/:itemId", staff, requireApproval("cancel_order"), orderController.removeItem);   // cancel one bill item
router.post("/table/:tableId/settle", roleMiddleware(["admin", "cashier"]), orderController.settleTable);
router.post("/table/:tableId/item", staff, orderController.addBillItem);   // add an item to the bill
router.get("/today-count", staff, orderController.getTodaysOrderCount);

// Bills screen — settled bills that can be corrected and reprinted.
// These sit above "/:id" so "bills" is never read as an order id.
router.get("/bills/today", billing, orderController.getTodaysBills);
router.get("/bills/:id", billing, orderController.getBill);
router.post("/:id/item", billing, orderController.addItemToOrder);   // add to THIS bill
router.put("/:id/rebill", billing, orderController.rebillOrder);     // recompute + sync payment

router.get("/:id/items", staff, orderController.getOrderDetails);
router.get("/:id", staff, orderController.getOrderById);

// Waiter marks a served order (before the generic /:id routes).
router.put("/:id/serve", roleMiddleware(["admin", "waiter", "cashier"]), orderController.markServed);

// Writes.
router.post("/", takers, requireApproval("discount", (req) => Number(req.body.discount) > 0), orderController.createOrder);
router.put("/:id", takers, requireApproval("discount", (req) => Number(req.body.discount) > 0), orderController.updateOrder);
router.delete("/:id", staff, requireApproval("cancel_order"), orderController.cancelOrder);   // soft cancel

module.exports = router;
