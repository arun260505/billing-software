const express = require("express");
const router = express.Router();

const categoryController = require("../controllers/categoryController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// All category endpoints require a valid JWT.
router.use(authMiddleware);

// Reading the category list is needed at the front desk too (e.g. filing a stock
// item under a category), so admin + cashier can read; only admin can change them.
router.get("/", roleMiddleware(["admin", "cashier"]), categoryController.getCategories);
router.get("/summary", roleMiddleware(["admin", "cashier"]), categoryController.getSummary);
router.post("/", roleMiddleware(["admin"]), categoryController.addCategory);
router.put("/:id", roleMiddleware(["admin"]), categoryController.updateCategory);
router.patch("/:id/timing", roleMiddleware(["admin"]), categoryController.updateCategoryTiming);
router.delete("/:id", roleMiddleware(["admin"]), categoryController.deleteCategory);

module.exports = router;
