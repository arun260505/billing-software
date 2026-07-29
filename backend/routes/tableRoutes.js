const express = require("express");
const router = express.Router();

const tableController = require("../controllers/tableController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// All table endpoints require a valid JWT (tenant-scoped).
router.use(authMiddleware);

// Reads: any authenticated role (staff need to see tables while serving).
router.get("/dashboard/stats", tableController.getDashboardStats);
router.get("/", tableController.getAllTables);
router.get("/:id", tableController.getTableById);

// Writes: admin only (table layout management).
router.post("/", roleMiddleware(["admin"]), tableController.createTable);
router.put("/:id", roleMiddleware(["admin"]), tableController.updateTable);
router.delete("/:id", roleMiddleware(["admin"]), tableController.deleteTable);

module.exports = router;
