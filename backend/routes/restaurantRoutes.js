const express = require("express");
const router = express.Router();

const restaurantController = require("../controllers/restaurantController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// This router had no auth at all, so `GET /api/restaurants` handed every
// restaurant's owner name, mobile, email, GSTIN, FSSAI number and address to
// anyone who asked — no token, no role, and across every tenant. On the cloud
// tier that is the whole customer list, publicly readable.
router.use(authMiddleware);

// Reads: any signed-in staff member (the till reads its own restaurant here).
router.get("/", restaurantController.getAllRestaurants);
router.get("/:id", restaurantController.getRestaurantById);

// Writes: creating, editing and deleting restaurants is super-admin work.
router.post("/", roleMiddleware(["super_admin"]), restaurantController.createRestaurant);
router.put("/:id", roleMiddleware(["super_admin", "admin"]), restaurantController.updateRestaurant);
router.delete("/:id", roleMiddleware(["super_admin"]), restaurantController.deleteRestaurant);

module.exports = router;