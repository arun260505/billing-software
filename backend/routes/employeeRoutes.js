const express = require("express");
const router = express.Router();

const employeeController = require("../controllers/employeeController");

router.get("/", employeeController.getEmployees);

router.get("/summary", employeeController.getSummary);
router.post("/", employeeController.addEmployee);

module.exports = router;