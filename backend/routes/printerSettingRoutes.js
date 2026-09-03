const express = require("express");
const router = express.Router();
const printerSettingController = require("../controllers/printerSettingController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Any authenticated restaurant staff (cashier, waiter, kitchen) reads the mode —
// it decides what their screen prints.
router.get("/", printerSettingController.getSetting);

// The mode is the admin's call.
router.put("/", roleMiddleware(["admin"]), printerSettingController.updateSetting);

// The devices are the till's — the cashier sets them up on the Printer page.
router.put(
    "/devices",
    roleMiddleware(["admin", "cashier"]),
    printerSettingController.updateDevices
);

module.exports = router;
