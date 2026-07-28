const express = require("express");
const router = express.Router();

const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Get Employees
router.get(
    "/",
    authMiddleware,
    roleMiddleware(["admin"]),
    employeeController.getEmployees
);

// Employee Summary
router.get(
    "/summary",
    authMiddleware,
    roleMiddleware(["admin"]),
    employeeController.getSummary
);

// Add Employee
router.post(
    "/",
    authMiddleware,
    roleMiddleware(["admin"]),
    employeeController.addEmployee
);

module.exports = router;