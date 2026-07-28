const express = require("express");

const router = express.Router();

const categoryController = require("../controllers/categoryController");

// ===============================
// Categories
// ===============================
router.get("/", categoryController.getCategories);

router.get("/summary", categoryController.getSummary);

router.post("/", categoryController.addCategory);

router.put("/:id", categoryController.updateCategory);

router.delete("/:id", categoryController.deleteCategory);

module.exports = router;