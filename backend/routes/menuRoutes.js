const express = require("express");

const router = express.Router();

const menuController = require("../controllers/menuController");

// Get all categories
router.get("/categories", menuController.getCategories);

// Get all menu items
router.get("/items", menuController.getAllItems);

// Get items by category
router.get("/items/category/:id", menuController.getItemsByCategory);

module.exports = router;