const express = require("express");

const router = express.Router();

const {
    createAdmin,
    getAdmins,
    deleteAdmin
} = require("../controllers/superAdminController");

router.post("/create-admin", createAdmin);

router.get("/admins", getAdmins);

router.delete("/admin/:id", deleteAdmin);

module.exports = router;