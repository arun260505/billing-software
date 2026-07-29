const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Reads: admin oversight + cashier at the till.
router.get("/", roleMiddleware(["admin", "cashier"]), paymentController.getAllPayments);
router.get("/:id", roleMiddleware(["admin", "cashier"]), paymentController.getPaymentById);

// Take payment: cashier.
router.post("/", roleMiddleware(["cashier"]), paymentController.createPayment);

// Delete/void: admin only.
router.delete("/:id", roleMiddleware(["admin"]), paymentController.deletePayment);

module.exports = router;
