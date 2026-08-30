const express = require("express");
const router = express.Router();
const syncController = require("../controllers/syncController");
const authMiddleware = require("../middleware/authMiddleware");

// Machine-to-machine channel (guarded by x-sync-key inside the controller).
router.post("/push", syncController.push);
router.get("/pull", syncController.pull);

// Admin "last synced" badge (staff-authenticated).
router.get("/status", authMiddleware, syncController.status);

module.exports = router;
