const express = require("express");
const router = express.Router();

const tableController = require("../controllers/tableController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// All table endpoints require a valid JWT (tenant-scoped).
router.use(authMiddleware);

// Reads — any authenticated role.
router.get("/dashboard/stats", tableController.getDashboardStats);
router.get("/", tableController.getAllTables);
router.get("/:id", tableController.getTableById);

// Waiter board — flip a table FREE/OCCUPIED.
router.put("/:id/status", roleMiddleware(["admin", "cashier", "waiter"]), tableController.updateTableStatus);

// Layout management — admin only.
router.post("/", roleMiddleware(["admin"]), tableController.createTable);
router.put("/:id", roleMiddleware(["admin"]), tableController.updateTable);
router.delete("/:id", roleMiddleware(["admin"]), tableController.deleteTable);

module.exports = router;
