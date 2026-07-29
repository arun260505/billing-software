const express = require("express");
const router = express.Router();

const menuController = require("../controllers/menuController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// All menu endpoints require a valid JWT (tenant-scoped).
router.use(authMiddleware);

// Reads: any authenticated role (waiters/cashiers need the menu to take orders).
router.get("/", menuController.getAllMenuItems);
router.get("/summary", menuController.getSummary);

// Writes: admin only.
router.post("/", roleMiddleware(["admin"]), menuController.addMenuItem);
router.put("/:id", roleMiddleware(["admin"]), menuController.updateMenuItem);
router.delete("/:id", roleMiddleware(["admin"]), menuController.deleteMenuItem);

module.exports = router;
