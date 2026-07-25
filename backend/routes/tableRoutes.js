const express = require("express");
const router = express.Router();

const tableController = require("../controllers/tableController");

// Get all tables
router.get("/", tableController.getAllTables);

// Get table by ID
router.get("/:id", tableController.getTableById);

// Create table
router.post("/", tableController.createTable);

// Update table
router.put("/:id", tableController.updateTable);

// Delete table
router.delete("/:id", tableController.deleteTable);

module.exports = router;