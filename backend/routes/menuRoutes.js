const express = require("express");
const router = express.Router();

const menuController = require("../controllers/menuController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, menuController.getAllMenuItems);

router.get("/summary", authMiddleware, menuController.getSummary);

router.post("/", authMiddleware, menuController.addMenuItem);

router.put("/:id", authMiddleware, menuController.updateMenuItem);

router.delete("/:id", authMiddleware, menuController.deleteMenuItem);

module.exports = router;