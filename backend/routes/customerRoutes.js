const express = require("express");
const router = express.Router();

const customerController = require("../controllers/customerController");

// Get all customers
router.get("/", customerController.getAllCustomers);

// Get customer by ID
router.get("/:id", customerController.getCustomerById);

// Create customer
router.post("/", customerController.createCustomer);

// Update customer
router.put("/:id", customerController.updateCustomer);

// Delete customer
router.delete("/:id", customerController.deleteCustomer);

module.exports = router;