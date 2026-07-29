const express = require("express");
const router = express.Router();

const categoryController = require("../controllers/categoryController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// All category endpoints require a valid JWT and admin role.
router.use(authMiddleware);
router.use(roleMiddleware(["admin"]));

router.get("/", categoryController.getCategories);
router.get("/summary", categoryController.getSummary);
router.post("/", categoryController.addCategory);
router.put("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);

module.exports = router;
