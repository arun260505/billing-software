const express = require("express");

const router = express.Router();

const adminController =
require("../controllers/adminController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// "Authentication middleware will be added later" stood here while the route
// was live and open. The handler reads req.user for its tenant scope, so
// unauthenticated calls were answering 500 rather than 401 — open, and broken.
router.use(authMiddleware);
router.use(roleMiddleware(["admin"]));

router.get(
    "/dashboard",
    adminController.getDashboard
);

module.exports = router;