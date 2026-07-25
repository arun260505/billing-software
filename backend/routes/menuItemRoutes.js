const express = require("express");
const router = express.Router();

const menuItemController = require("../controllers/menuItemController");

// Get all menu items
router.get("/", menuItemController.getAllMenuItems);

// Get menu item by ID
router.get("/:id", menuItemController.getMenuItemById);

// Create menu item
router.post("/", menuItemController.createMenuItem);

// Update menu item
router.put("/:id", menuItemController.updateMenuItem);

// Delete menu item
router.delete("/:id", menuItemController.deleteMenuItem);

module.exports = router;