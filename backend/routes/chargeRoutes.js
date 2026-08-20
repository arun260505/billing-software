const express = require("express");
const router = express.Router();
const chargeController = require("../controllers/chargeController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware(["admin"]));

router.get("/", chargeController.getCharges);
router.get("/summary", chargeController.getChargeSummary);
router.post("/", chargeController.createCharge);
router.put("/:id", chargeController.updateCharge);
router.delete("/:id", chargeController.deleteCharge);
router.post("/:id/duplicate", chargeController.duplicateCharge);

module.exports = router;
