const express = require("express");
const router = express.Router();
const activationController = require("../controllers/activationController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Super admin generates / views a restaurant's activation key.
router.post(
    "/generate",
    authMiddleware,
    roleMiddleware(["super_admin"]),
    activationController.generate
);

// The installer activates a machine with the key (public).
router.post("/", activationController.activate);

module.exports = router;
