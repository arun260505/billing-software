const dashboardModel = require("../models/dashboardModel");
const { success, error } = require("../utils/response");

exports.getSummary = (req, res) => {

    dashboardModel.getSummary(req.user.restaurant_id, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Dashboard summary fetched.", result[0]);

    });

};

exports.getTodaysSales = (req, res) => {

    dashboardModel.getTodaysSales(req.user.restaurant_id, (err, result) => {

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

    dashboardModel.getSalesChart(period, req.user.restaurant_id, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Sales chart fetched.", result);

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
