const express = require("express");
const router = express.Router();
const printController = require("../controllers/printController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// The till screens that produce receipts: the cashier prints bills and kitchen
// copies, the waiter's send-to-kitchen prints a KOT on a two-printer setup, and
// an admin can run a test print.
router.post(
    "/",
    roleMiddleware(["cashier", "admin", "waiter"]),
    printController.print
);

module.exports = router;
