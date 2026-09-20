const dashboardModel = require("../models/dashboardModel");
const { success, error } = require("../utils/response");

// The client's local (IST) date, so "today" figures match the wall-clock in
// front of the owner — not the cloud server's UTC date. Only the YYYY-MM-DD
// shape is trusted; anything else falls back to the server's today.
function pickDate(v) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

exports.getSummary = (req, res) => {

    dashboardModel.getSummary(req.user.restaurant_id, pickDate(req.query.date), (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Dashboard summary fetched.", result[0]);

    });

};

exports.getTodaysSales = (req, res) => {

    dashboardModel.getTodaysSales(req.user.restaurant_id, pickDate(req.query.date), (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Today's sales fetched.", result);

    });

};

exports.getRecentOrders = (req, res) => {

    dashboardModel.getRecentOrders(req.user.restaurant_id, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Recent orders fetched.", result);

    });

};

exports.getTopItems = (req, res) => {

    dashboardModel.getTopItems(req.user.restaurant_id, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Top items fetched.", result);

    });

};

exports.getTableStatus = (req, res) => {

    dashboardModel.getTableStatus(req.user.restaurant_id, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Table status fetched.", result);

    });

};

exports.getSalesChart = (req, res) => {

    const period = req.query.period || "today";

    dashboardModel.getSalesChart(period, req.user.restaurant_id, pickDate(req.query.date), (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Sales chart fetched.", result);

    });

};

// GET /api/dashboard/stylists — the salon's live stylist board for today.
exports.getStylistBoard = (req, res) => {

    dashboardModel.getStylistBoard(req.user.restaurant_id, pickDate(req.query.date), (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Stylist board fetched.", result);

    });

};

// GET /api/dashboard/waiters — today's waiter activity for the restaurant.
exports.getWaiterBoard = (req, res) => {

    dashboardModel.getWaiterBoard(req.user.restaurant_id, pickDate(req.query.date), (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Waiter activity fetched.", result);

    });

};

// Heartbeat for the Connection Status widget: verifies backend + database.
exports.getHealth = (req, res) => {

    dashboardModel.ping((err) => {

        if (err) {
            return success(res, "Service status fetched.", {
                server: true,
                db: false,
                server_time: new Date().toISOString()
            });
        }

        return success(res, "Service status fetched.", {
            server: true,
            db: true,
            server_time: new Date().toISOString()
        });

    });

};
