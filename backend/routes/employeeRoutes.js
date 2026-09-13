const express = require("express");
const router = express.Router();

const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// The salon's stylists, for the billing screen — the receptionist needs the
// names too. Registered before the admin-only gate below.
router.get("/stylists", roleMiddleware(["admin", "cashier"]), employeeController.getStylists);

// Every other employee endpoint is admin only.
router.use(roleMiddleware(["admin"]));

router.get("/", employeeController.getEmployees);
router.get("/summary", employeeController.getSummary);
router.post("/", employeeController.addEmployee);

// Edit and remove — the Employee page had buttons for both with no routes behind
// them, so nothing happened when they were clicked.
router.put("/:id", employeeController.updateEmployee);
router.delete("/:id", employeeController.deleteEmployee);

module.exports = router;
