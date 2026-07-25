const dashboardModel = require("../models/dashboardModel");

const getDashboard = async (req, res) => {

    try {

        // Later we'll get this from JWT
        const restaurantId = 1;

        const dashboard =
            await dashboardModel.getDashboardSummary(restaurantId);

        res.status(200).json({
            success: true,
            message: "Dashboard loaded successfully.",
            data: dashboard
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load dashboard."
        });

    }

};

module.exports = {
    getDashboard
};