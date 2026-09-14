const notificationModel = require("../models/notificationModel");
const { success, error } = require("../utils/response");

// GET /api/notifications?since_id=<id>&limit=<n>
// The owner app polls this: pass the highest id it has already seen to get only
// what's new. Scoped to the caller's restaurant from the JWT.
exports.list = async (req, res) => {
    try {
        const rows = await notificationModel.list(req.user.restaurant_id, {
            sinceId: req.query.since_id,
            limit: req.query.limit,
        });
        return success(res, "Notifications fetched.", rows);
    } catch (e) {
        return error(res, e.message, 500);
    }
};
