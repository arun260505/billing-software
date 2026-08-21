const express = require("express");
const router = express.Router();
const chargeController = require("../controllers/chargeController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

router.get("/", roleMiddleware(["admin", "cashier"]), chargeController.getCharges);
router.get("/summary", roleMiddleware(["admin"]), chargeController.getChargeSummary);
router.post("/", roleMiddleware(["admin"]), chargeController.createCharge);
router.put("/:id", roleMiddleware(["admin"]), chargeController.updateCharge);
router.delete("/:id", roleMiddleware(["admin"]), chargeController.deleteCharge);
router.post("/:id/duplicate", roleMiddleware(["admin"]), chargeController.duplicateCharge);

module.exports = router;
