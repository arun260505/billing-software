const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Dashboard analytics are for the restaurant admin.
router.use(authMiddleware);
router.use(roleMiddleware(["admin"]));

router.get("/summary", dashboardController.getSummary);
router.get("/todays-sales", dashboardController.getTodaysSales);
router.get("/recent-orders", dashboardController.getRecentOrders);
router.get("/top-items", dashboardController.getTopItems);
router.get("/tables", dashboardController.getTableStatus);
router.get("/sales-chart", dashboardController.getSalesChart);
router.get("/health", dashboardController.getHealth);
// Salon: today's customers / bills / sales per stylist (the live board).
router.get("/stylists", dashboardController.getStylistBoard);
// Restaurant: today's orders / items / bills / sales per waiter (live board).
router.get("/waiters", dashboardController.getWaiterBoard);

module.exports = router;
