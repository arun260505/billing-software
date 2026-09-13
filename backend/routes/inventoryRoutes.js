const express = require("express");
const router = express.Router();

const inventoryController = require("../controllers/inventoryController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Stock is the owner's to manage; every query is scoped to the JWT's restaurant.
router.use(authMiddleware);
router.use(roleMiddleware(["admin"]));

// Static paths before "/:id".
router.get("/", inventoryController.getItems);
router.get("/summary", inventoryController.getSummary);
router.get("/movements", inventoryController.getMovements);
router.post("/", inventoryController.createItem);
router.put("/:id", inventoryController.updateItem);
router.delete("/:id", inventoryController.deleteItem);
router.post("/:id/stock", inventoryController.moveStock);
router.get("/:id/movements", inventoryController.getMovements);

module.exports = router;
