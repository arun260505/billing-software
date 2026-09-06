const express = require("express");
const router = express.Router();
const chargeController = require("../controllers/chargeController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Waiter needs to READ the charge list so the app's bill preview totals GST /
// service the same way the till does — otherwise the waiter's total omits them
// and the settle is refused for not matching. Writes stay admin-only below.
router.get("/", roleMiddleware(["admin", "cashier", "waiter"]), chargeController.getCharges);
router.get("/summary", roleMiddleware(["admin"]), chargeController.getChargeSummary);
router.post("/", roleMiddleware(["admin"]), chargeController.createCharge);
router.put("/:id", roleMiddleware(["admin"]), chargeController.updateCharge);
router.delete("/:id", roleMiddleware(["admin"]), chargeController.deleteCharge);
router.post("/:id/duplicate", roleMiddleware(["admin"]), chargeController.duplicateCharge);

module.exports = router;
