const express = require("express");

const router = express.Router();

const tableController = require("../controllers/tableController");

// Get all tables
router.get("/", tableController.getTables);

// Get single table
router.get("/:id", tableController.getTableById);

// Update table status
router.put("/:id/status", tableController.updateTableStatus);

module.exports = router;
