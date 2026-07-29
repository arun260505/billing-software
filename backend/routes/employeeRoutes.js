const express = require("express");
const router = express.Router();

const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Every employee endpoint requires a valid JWT and admin role.
router.use(authMiddleware);
router.use(roleMiddleware(["admin"]));

router.get("/", employeeController.getEmployees);
router.get("/summary", employeeController.getSummary);
router.post("/", employeeController.addEmployee);

module.exports = router;
