const express = require("express");
const router = express.Router();

const customerController = require("../controllers/customerController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Customers are managed by admin and used by front-of-house staff.
router.use(authMiddleware);

const staff = roleMiddleware(["admin", "cashier", "waiter"]);

// Static paths before "/:id" so "lookup" is never read as an id.
router.get("/", staff, customerController.getAllCustomers);
router.get("/lookup", staff, customerController.lookupByMobile);
router.get("/search", staff, customerController.searchCustomers);
// Billing counter: find-or-create by mobile number.
router.post("/resolve", roleMiddleware(["admin", "cashier"]), customerController.resolveCustomer);
router.get("/:id/history", staff, customerController.getCustomerHistory);
router.get("/:id", staff, customerController.getCustomerById);
router.post("/", staff, customerController.createCustomer);
router.put("/:id", staff, customerController.updateCustomer);
// Removing a customer drops them from the list for everyone — admin only.
router.delete("/:id", roleMiddleware(["admin"]), customerController.deleteCustomer);

module.exports = router;
