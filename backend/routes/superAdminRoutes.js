const express = require("express");

const router = express.Router();

const {
    createAdmin,
    getAdmins,
    updateAdmin,
    deleteAdmin
} = require("../controllers/superAdminController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// This router had NO auth of any kind: every other router calls
// router.use(authMiddleware), this one never did and the mount in server.js
// adds none either. So `GET /api/super-admin/admins` returned the admin list to
// anybody who asked, and `POST /api/super-admin/create-admin` would mint a new
// restaurant admin with no credentials at all — reachable from every phone on
// the restaurant WiFi, and from the open internet on the cloud tier.
//
// These endpoints create, edit and delete the accounts that own restaurants, so
// they are super-admin only.
router.use(authMiddleware);
router.use(roleMiddleware(["super_admin"]));

router.post("/create-admin", createAdmin);

router.get("/admins", getAdmins);

router.put("/admin/:id", updateAdmin);

router.delete("/admin/:id", deleteAdmin);

module.exports = router;