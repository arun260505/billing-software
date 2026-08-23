const reportModel = require("../models/reportModel");
const { success, error } = require("../utils/response");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

const toDateOnly = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const resolveRange = (req) => {

    const today = new Date();
    const from = req.query.from;
    const to = req.query.to;

    if (from || to) {

        if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "")) {
            return { error: "Invalid date range. Use YYYY-MM-DD for both from and to." };
        }

        if (from > to) {
            return { error: "'from' date must be before or equal to 'to' date." };
        }

        const days = Math.round(
            (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000
        ) + 1;

        if (days > MAX_RANGE_DAYS) {
            return { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days.` };
        }

        return { from, to };

    }

    return { from: toDateOnly(today), to: toDateOnly(today) };

};

const safeOverview = async ({ restaurantId, from, to }) => {

    try {
        const data = await reportModel.getOverview({ restaurantId, from, to });
        return { data };
    } catch (err) {
        return { err };
    }

};

exports.getOverview = (req, res) => {

    const range = resolveRange(req);

    if (range.error) return error(res, range.error, 400);

    safeOverview({
        restaurantId: req.user.restaurant_id,
        from: range.from,
        to: range.to
    }).then(({ data, err }) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Reports overview fetched.", data);

    });

};

exports.getDailySales = (req, res) => {

    reportModel.getDailySales(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Daily sales fetched.", results);

    });

};

exports.getMonthlySales = (req, res) => {

    reportModel.getMonthlySales(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Monthly sales fetched.", results);

    });

};

exports.getPaymentSummary = (req, res) => {

    reportModel.getPaymentSummary(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Payment summary fetched.", results);

    });

};

exports.getTopSellingItems = (req, res) => {

    reportModel.getTopSellingItems(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Top selling items fetched.", results);

    });

};

exports.getEmployeeSales = (req, res) => {

    reportModel.getEmployeeSales(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Employee sales fetched.", results);

    });

};

exports.getTableSales = (req, res) => {

    reportModel.getTableSales(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Table sales fetched.", results);

    });

};

