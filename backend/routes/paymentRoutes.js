const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/paymentController");

// Get all payments
router.get("/", paymentController.getAllPayments);

// Get payment by ID
router.get("/:id", paymentController.getPaymentById);

// Create payment
router.post("/", paymentController.createPayment);

// Delete payment
router.delete("/:id", paymentController.deletePayment);

module.exports = router;