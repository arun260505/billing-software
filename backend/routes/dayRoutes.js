const express = require("express");
const router = express.Router();

const dayController = require("../controllers/dayController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// The cashier/receptionist runs the day; the admin/owner can open & close too.
const staff = roleMiddleware(["admin", "cashier"]);

router.get("/state", staff, dayController.getState);
router.get("/summary", staff, dayController.getSummary);
router.get("/pending", staff, dayController.getPending);
router.get("/closures", staff, dayController.getClosures);
router.post("/open", staff, dayController.open);
router.post("/close", staff, dayController.close);

module.exports = router;
