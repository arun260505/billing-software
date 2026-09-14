const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/notificationController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// The owner alerts feed — read by the salon owner's phone app. Owner only.
router.use(authMiddleware);
router.get("/", roleMiddleware(["admin"]), notificationController.list);

module.exports = router;
