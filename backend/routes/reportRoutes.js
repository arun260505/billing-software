const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reportController");

router.get("/daily-sales", reportController.getDailySales);
router.get("/monthly-sales", reportController.getMonthlySales);
router.get("/payment-summary", reportController.getPaymentSummary);
router.get("/top-selling-items", reportController.getTopSellingItems);
router.get("/employee-sales", reportController.getEmployeeSales);
router.get("/table-sales", reportController.getTableSales);

module.exports = router;