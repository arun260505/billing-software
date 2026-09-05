const express = require("express");
const router = express.Router();

const menuItemController = require("../controllers/menuItemController");
const authMiddleware = require("../middleware/authMiddleware");

// NOTE: this router is not mounted in server.js — the admin Menu page uses
// /api/menu (menuController), which scopes restaurant_id from the JWT. This
// controller takes restaurant_id from the REQUEST BODY instead, against the
// tenant rule in PROJECT_STATUS.md, so mounting it as-is would let any caller
// write menu items into another restaurant. Guarded here so it cannot be
// wired up unprotected by accident; the body-trust issue still needs fixing
// before this is mounted, or the file should be deleted.
router.use(authMiddleware);

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