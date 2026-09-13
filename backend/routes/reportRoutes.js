const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { restaurantOnly } = require("../middleware/businessTypeMiddleware");

// Report data is tenant-restricted: only the restaurant admin may read it,
// and every query is scoped to req.user.restaurant_id from the JWT.
router.use(authMiddleware);
router.use(roleMiddleware(["admin"]));

router.get("/overview", reportController.getOverview);
router.get("/daily-sales", reportController.getDailySales);
router.get("/monthly-sales", reportController.getMonthlySales);
router.get("/payment-summary", reportController.getPaymentSummary);
router.get("/top-selling-items", reportController.getTopSellingItems);
router.get("/employee-sales", reportController.getEmployeeSales);
router.get("/table-sales", restaurantOnly, reportController.getTableSales);

module.exports = router;