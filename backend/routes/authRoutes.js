const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/login", authController.login);

// Verify JWT and return logged-in user
router.get("/me", authMiddleware, authController.me);

module.exports = router;